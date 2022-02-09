import { glob } from "glob";
import ts from "typescript";
import * as fs from "fs";
import { readCompilerOptions } from "../tsc/compilerOptions";
import { execSync } from "child_process";

function getTarget(target: string) {
  switch (target.toLowerCase()) {
    case "es2015":
      return ts.ScriptTarget.ES2015;
    case "es2016":
      return ts.ScriptTarget.ES2016;
    case "es2017":
      return ts.ScriptTarget.ES2017;
    case "es2018":
      return ts.ScriptTarget.ES2018;
    case "es2019":
      return ts.ScriptTarget.ES2019;
    case "es2020":
      return ts.ScriptTarget.ES2020;
    case "es2021":
      return ts.ScriptTarget.ES2021;
    case "es3":
      return ts.ScriptTarget.ES3;
    case "es5":
      return ts.ScriptTarget.ES5;
    case "esnext":
      return ts.ScriptTarget.ESNext;
    default:
      return ts.ScriptTarget.ESNext;
  }
}

async function main() {
  // this assumes this is being run from root of directory
  const options = readCompilerOptions(".");
  let files = glob.sync("src/schema/*.ts");

  const target = options.target
    ? // @ts-ignore
      getTarget(options.target)
    : ts.ScriptTarget.ESNext;

  // filter to only event.ts e.g. for comments and whitespace...
  files = files.filter((f) => f.endsWith("user.ts"));

  files.forEach((file) => {
    // assume valid file since we do glob above
    const idx = file.lastIndexOf(".ts");
    const writeFile = file.substring(0, idx) + "2" + ".ts";

    let contents = fs.readFileSync(file).toString();

    // go through the file and print everything back if not starting immediately after other position
    const sourceFile = ts.createSourceFile(
      file,
      contents,
      target,
      false,
      ts.ScriptKind.TS,
    );
    const nodes: NodeInfo[] = [];
    let updateImport = false;
    const f = {
      trackNode: function (tni: TrackNodeInfo) {
        nodes.push({
          node: tni.node,
          importNode: tni.node && ts.isImportDeclaration(tni.node),
          rawString: tni.rawString,
        });
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
        const transformedImport = transformImport(importNode, sourceFile);
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
  const ci = getClassInfo(fileContents, sourceFile, node);
  if (!ci) {
    return false;
  }

  let klassContents = `${ci.comment}const ${ci.name} = new ${ci.extends}({\n`;

  for (let member of node.members) {
    const fInfo = getClassElementInfo(fileContents, member, sourceFile);
    if (!fInfo) {
      return false;
    }
    klassContents += `${fInfo.comment}${fInfo.key}:${fInfo.value},\n`;
  }

  klassContents += "\n})";
  if (ci.export && ci.default) {
    klassContents += `\n export default ${ci.name};`;
  } else if (ci.export) {
    klassContents = "export " + klassContents;
  }
  //  console.debug(klassContents);

  f.trackNode({ rawString: klassContents });

  return true;
}

interface classInfo {
  extends: string;
  comment: string;
  name: string;
  export?: boolean;
  default?: boolean;
}

function getClassInfo(
  fileContents: string,
  sourceFile: ts.SourceFile,
  node: ts.ClassDeclaration,
): classInfo | undefined {
  const className = node.name?.text;

  let classExtends: string | undefined;
  if (node.heritageClauses) {
    for (const hc of node.heritageClauses) {
      if (hc.token !== ts.SyntaxKind.ExtendsKeyword) {
        continue;
      }
      // can only extend one class
      for (const type of hc.types) {
        classExtends = type.expression.getText(sourceFile);
        switch (classExtends) {
          // only do known class names
          case "BaseEntSchema":
          case "BaseEntSchemaWithTZ":
            break;
          default:
            return undefined;
        }
      }
    }
  }

  if (!className || !node.heritageClauses || !classExtends) {
    return undefined;
  }

  let ci: classInfo = {
    name: className,
    extends: classExtends,
    comment: getPreText(fileContents, node, sourceFile),
  };

  if (node.modifiers) {
    for (const mod of node.modifiers) {
      const text = mod.getText(sourceFile);
      if (text === "export") {
        ci.export = true;
      } else if (text === "default") {
        ci.default = true;
      }
    }
  }
  return ci;
}

interface propertyInfo {
  key: string;
  value: string;
  comment: string;
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
  };
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

function transformImport(
  importNode: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
): string | undefined {
  // remove quotes too
  const text = importNode.moduleSpecifier.getText(sourceFile).slice(1, -1);
  if (
    text !== "@snowtop/ent" &&
    text !== "@snowtop/ent/schema" &&
    text !== "@snowtop/ent/schema/"
  ) {
    return;
  }
  const importText = importNode.importClause?.getText(sourceFile) || "";
  const start = importText.indexOf("{");
  const end = importText.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return;
  }
  const imports = importText
    .substring(start + 1, end)
    //    .trim()
    .split(",");
  for (let i = 0; i < imports.length; i++) {
    const imp = imports[i].trim();
    if (imp === "Field") {
      imports[i] = "FieldMap";
    }
  }

  return (
    "import " +
    importText.substring(0, start + 1) +
    imports.join(", ") +
    importText.substring(end) +
    ' from "' +
    text +
    '"'
  );
}

function getPreText(
  fileContents: string,
  node: ts.Node,
  sourceFile: ts.SourceFile,
): string {
  return fileContents.substring(node.getFullStart(), node.getStart(sourceFile));
}

Promise.resolve(main());
