import { glob } from "glob";
import ts from "typescript";
import * as fs from "fs";
import { readCompilerOptions } from "./helpers";
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
  const options = readCompilerOptions();
  let files = glob.sync("src/schema/*.ts");

  const target = options.target
    ? // @ts-ignore
      getTarget(options.target)
    : ts.ScriptTarget.ESNext;

  // filter to only event.ts e.g. for comments and whitespace...
  //  files = files.filter((f) => f.endsWith("event.ts"));

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

// TODO need to replace class field member, print that and see what happens
function traverseClass(
  fileContents: string,
  sourceFile: ts.SourceFile,
  node: ts.ClassDeclaration,
  f: File,
): boolean {
  let updated = false;

  // beginning of class...
  // including comment
  let klassContents = fileContents.substring(
    node.getFullStart(),
    node.members[0].getFullStart(),
  );

  for (let member of node.members) {
    if (!isFieldElement(member, sourceFile)) {
      klassContents += member.getFullText(sourceFile);
      continue;
    }
    // intentionally doesn't parse decorators since we don't need it

    let fieldMap = "";
    // fieldMapComment...
    const comment = getPreText(fileContents, member, sourceFile);
    if (comment) {
      fieldMap += comment;
    }

    updated = true;
    // need to change to fields: FieldMap = {code: StringType()};
    const property = member as ts.PropertyDeclaration;
    const initializer = property.initializer as ts.ArrayLiteralExpression;

    fieldMap += "fields: FieldMap = {";
    for (const element of initializer.elements) {
      const parsed = parseFieldElement(element, sourceFile, fileContents);
      if (parsed === null) {
        return false;
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
    klassContents += fieldMap;
  }

  klassContents += "\n}";

  //  console.debug(klassContents);

  if (!updated) {
    return updated;
  }

  f.trackNode({ rawString: klassContents });

  return updated;
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
  // TODO better to update node instead of doing this but this works for now

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
