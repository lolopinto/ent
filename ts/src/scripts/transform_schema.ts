import { glob } from "glob";
import ts from "typescript";
import * as fs from "fs";
import {
  getTargetFromCurrentDir,
  createSourceFile,
} from "../tsc/compilerOptions";
import { execSync } from "child_process";
import path from "path";
import { getClassInfo, getPreText, transformImport } from "../tsc/ast";

async function main() {
  let files = glob.sync("src/schema/*.ts");

  const target = getTargetFromCurrentDir();

  // filter to only event.ts e.g. for comments and whitespace...
  //  files = files.filter((f) => f.endsWith("event.ts"));

  files.forEach((file) => {
    // assume valid file since we do glob above
    //    const idx = file.lastIndexOf(".ts");
    //    const writeFile = file.substring(0, idx) + "2" + ".ts";
    //    console.debug(file);
    const writeFile =
      "src/schema/" + path.basename(file).slice(0, -3) + "_schema.ts";
    // const writeFile = file;
    //    console.debug(file, writeFile);

    // go through the file and print everything back if not starting immediately after other position
    let { contents, sourceFile } = createSourceFile(target, file);

    const nodes: NodeInfo[] = [];
    let updateImport = false;
    let removeImports: string[] = [];
    const f = {
      trackNode: function (tni: TrackNodeInfo) {
        nodes.push({
          node: tni.node,
          importNode: tni.node && ts.isImportDeclaration(tni.node),
          rawString: tni.rawString,
        });
        if (tni.removeImports) {
          removeImports.push(...tni.removeImports);
        }
      },
      flagUpdateImport() {
        updateImport = true;
      },
    };
    if (!traverse(contents, sourceFile, f)) {
      return;
    }

    let newContents = "";
    for (const node of nodes) {
      if (updateImport && node.importNode) {
        const importNode = node.node as ts.ImportDeclaration;
        const transformedImport = transformImport(
          contents,
          importNode,
          sourceFile,
          {
            removeImports,
            transform: transformSchema,
          },
        );
        if (transformedImport) {
          newContents += transformedImport;
          continue;
        }
      }

      if (node.node) {
        newContents += node.node.getFullText(sourceFile);
      } else if (node.rawString) {
        newContents += node.rawString;
      } else {
        console.error("invalid node");
      }
    }
    //    console.debug(newContents);

    // ideally there's a flag that indicates if we write
    fs.writeFileSync(writeFile, newContents);
    fs.rmSync(file);
  });

  execSync("prettier src/schema/*.ts --write");
}

interface File {
  trackNode(tn: TrackNodeInfo): void;
  flagUpdateImport(): void;
}

interface TrackNodeInfo {
  node?: ts.Node;
  rawString?: string;
  removeImports?: string[];
}

interface NodeInfo {
  node?: ts.Node;
  importNode?: boolean;
  rawString?: string;
}

function traverse(
  fileContents: string,
  sourceFile: ts.SourceFile,
  f: File,
): boolean {
  let traversed = false;
  ts.forEachChild(sourceFile, function (node: ts.Node) {
    if (ts.isClassDeclaration(node)) {
      traversed = true;
      // TODO address implicit schema doesn't work here...
      //        console.debug(sourceFile.fileName, node.kind);
      if (traverseClass(fileContents, sourceFile, node, f)) {
        f.flagUpdateImport();
        return;
      }
    }
    f.trackNode({ node });
  });
  return traversed;
}

function traverseClass(
  fileContents: string,
  sourceFile: ts.SourceFile,
  node: ts.ClassDeclaration,
  f: File,
): boolean {
  const ci = getTransformClassInfo(fileContents, sourceFile, node);
  if (!ci) {
    return false;
  }

  let klassContents = `${ci.comment}const ${ci.name} = new ${ci.class}({\n`;
  let removeImports: string[] = [];
  if (ci.implementsSchema) {
    removeImports.push("Schema");
  }

  for (let member of node.members) {
    const fInfo = getClassElementInfo(fileContents, member, sourceFile);
    if (!fInfo) {
      return false;
    }
    klassContents += `${fInfo.comment}${fInfo.key}:${fInfo.value},\n`;
    if (fInfo.type) {
      removeImports.push(fInfo.type);
    }
  }

  klassContents += "\n})";
  if (ci.export && ci.default) {
    klassContents += `\n export default ${ci.name};`;
  } else if (ci.export) {
    klassContents = "export " + klassContents;
  }
  //  console.debug(klassContents);

  f.trackNode({ rawString: klassContents, removeImports: removeImports });

  return true;
}

interface classInfo {
  class: string;
  comment: string;
  name: string;
  export?: boolean;
  default?: boolean;
  implementsSchema?: boolean;
}

function transformSchema(str: string): string {
  // only do known class names
  if (str === "BaseEntSchema" || str === "BaseEntSchemaWithTZ") {
    return str.substring(4);
  }
  return str;
}

// TODO need to generify this...
// and then have a schema specific version
// may make sense to just duplicate this logic...
function getTransformClassInfo(
  fileContents: string,
  sourceFile: ts.SourceFile,
  node: ts.ClassDeclaration,
): classInfo | undefined {
  const generic = getClassInfo(fileContents, sourceFile, node);
  if (!generic) {
    return;
  }

  let className = generic.name;
  if (!className?.endsWith("Schema")) {
    className += "Schema";
  }
  let implementsSchema = generic.implements?.some((v) => v == "Schema");
  let classExtends = generic.extends;
  if (classExtends && classExtends === transformSchema(classExtends)) {
    return undefined;
  }

  if (!className || !node.heritageClauses || !classExtends) {
    return undefined;
  }

  let ci: classInfo = {
    ...generic,
    name: className,
    class: classExtends,
    implementsSchema,
  };

  return ci;
}

interface propertyInfo {
  key: string;
  value: string;
  comment: string;
  type?: string;
}

// intentionally doesn't parse decorators since we don't need it
function getClassElementInfo(
  fileContents: string,
  member: ts.ClassElement,
  sourceFile: ts.SourceFile,
): propertyInfo | undefined {
  if (isFieldElement(member, sourceFile)) {
    return getFieldElementInfo(fileContents, member, sourceFile);
  }
  if (member.kind === ts.SyntaxKind.Constructor) {
    return getConstructorElementInfo(fileContents, member, sourceFile);
  }
  if (member.kind !== ts.SyntaxKind.PropertyDeclaration) {
    return;
  }
  // other properties
  const property = member as ts.PropertyDeclaration;
  if (!property.initializer) {
    return;
  }
  const token = property.name as ts.Identifier;

  return {
    key: token.escapedText.toString(),
    value: property.initializer?.getFullText(sourceFile),
    comment: getPreText(fileContents, member, sourceFile),
    type: getType(property, sourceFile),
  };
}

function getType(
  property: ts.PropertyDeclaration,
  sourceFile: ts.SourceFile,
): string {
  let propertytype = property.type?.getText(sourceFile) || "";
  let ends = ["| null", "[]"];
  for (const end of ends) {
    if (propertytype.endsWith(end)) {
      propertytype = propertytype.slice(0, -1 * end.length);
    }
  }
  return propertytype;
}

function getFieldElementInfo(
  fileContents: string,
  member: ts.ClassElement,
  sourceFile: ts.SourceFile,
): propertyInfo | undefined {
  let fieldMap = "";

  // need to change to fields: {code: StringType()};
  const property = member as ts.PropertyDeclaration;
  const initializer = property.initializer as ts.ArrayLiteralExpression;

  fieldMap += "{";
  for (const element of initializer.elements) {
    const parsed = parseFieldElement(element, sourceFile, fileContents);
    if (parsed === null) {
      return;
    }
    const { callEx, name, nameComment, properties } = parsed;

    let property = "";
    const fieldComment = getPreText(fileContents, element, sourceFile).trim();
    if (fieldComment) {
      property += "\n" + fieldComment + "\n";
    }
    if (nameComment) {
      property += nameComment + "\n";
    }

    // e.g. UUIDType, StringType etc
    let call = callEx.expression.getText(sourceFile);
    let fnCall = "";
    if (properties.length) {
      fnCall = `{${properties.join(",")}}`;
    }
    property += `${name}:${call}(${fnCall}),`;

    fieldMap += property;
  }
  fieldMap += "}";

  return {
    key: "fields",
    value: fieldMap,
    comment: getPreText(fileContents, member, sourceFile),
    type: getType(property, sourceFile),
  };
}

function getConstructorElementInfo(
  fileContents: string,
  member: ts.ClassElement,
  sourceFile: ts.SourceFile,
): propertyInfo | undefined {
  const c = member as ts.ConstructorDeclaration;
  //remove {}
  let fullText = c.body?.getFullText(sourceFile) || "";
  fullText = fullText.trim().slice(1, -1).trim();

  // convert something like
  /*
  constructor() {
    super();
    this.addPatterns(
      new Feedback(),
      new DayOfWeek(),
      new Feedback(),
      new DayOfWeek(),
    );
  }
    */
  // into this.addPatterns(new Feedback(),new DayOfWeek(),new Feedback(),new DayOfWeek(),)
  const lines = fullText
    .split("\n")
    .map((line) => line.trim())
    .join("")
    .split(";")
    .filter((f) => f != "super()" && f != "");
  // at this point there should be only line for what we handle
  if (lines.length != 1) {
    return;
  }
  const line = lines[0];
  const addPatterns = "this.addPatterns(";
  if (!line.startsWith(addPatterns)) {
    return;
  }

  return {
    key: "patterns",
    // remove this.addPatterns at the front, remove trailing ) at the end
    // if there's a trailing comma, it'll be handled by prettier
    value: `[${line.slice(addPatterns.length, -1)}]`,
    comment: "",
  };
}

function isFieldElement(
  member: ts.ClassElement,
  sourceFile: ts.SourceFile,
): boolean {
  if (member.kind !== ts.SyntaxKind.PropertyDeclaration) {
    return false;
  }
  const property = member as ts.PropertyDeclaration;
  const token = property.name as ts.Identifier;
  if (token.escapedText !== "fields") {
    return false;
  }

  const propertytype = property.type?.getText(sourceFile);
  if (propertytype !== "Field[]") {
    return false;
  }

  if (property.initializer?.kind !== ts.SyntaxKind.ArrayLiteralExpression) {
    console.error("invalid array type");
    return false;
  }

  return true;
}

interface ParsedFieldElement {
  // parsedCallExpression
  callEx: ts.CallExpression;
  // name of field
  name: string;
  // any comment associated with just the name
  nameComment?: string;
  // other properties (and their comments) e.g. nullable: true
  properties: string[];
}

function parseFieldElement(
  element: ts.Expression,
  sourceFile: ts.SourceFile,
  fileContents: string,
): ParsedFieldElement | null {
  if (element.kind !== ts.SyntaxKind.CallExpression) {
    console.error("skipped non-call expression");
    return null;
  }
  let callEx = element as ts.CallExpression;
  if (callEx.arguments.length !== 1) {
    console.error("callExpression with arguments not of length 1");
    return null;
  }
  let arg = callEx.arguments[0];
  if (arg.kind !== ts.SyntaxKind.ObjectLiteralExpression) {
    console.error("not objectLiteralExpression");
    return null;
  }

  let expr = arg as ts.ObjectLiteralExpression;
  let name = "";
  let propertyComment: string | undefined;
  let properties: string[] = [];

  for (const p of expr.properties) {
    const p2 = p as ts.PropertyAssignment;

    // found name property
    if ((p2.name as ts.Identifier).escapedText === "name") {
      name = p2.initializer.getText(sourceFile);
      // check for any comment associated with name: "fooo"
      propertyComment = getPreText(fileContents, p, sourceFile).trim();
    } else {
      properties.push(p.getFullText(sourceFile));
    }
  }

  if (!name) {
    console.error(`couldn't find name property`);
    return null;
  }
  // remove quotes
  name = name.slice(1, -1);

  return {
    callEx,
    name,
    properties,
    nameComment: propertyComment,
  };
}

Promise.resolve(main());
