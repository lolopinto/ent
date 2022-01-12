import { glob } from "glob";
import ts from "typescript";
import * as fs from "fs";
import { readCompilerOptions } from "./helpers";

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
  const files = glob.sync("src/schema/*.ts");

  const target = options.target
    ? // @ts-ignore
      getTarget(options.target)
    : ts.ScriptTarget.ESNext;

  // contact instead of auth_code
  [files[5]].forEach((file) => {
    const sourceFile = ts.createSourceFile(
      file,
      fs.readFileSync(file).toString(),
      target,
    );
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const nodes: NodeInfo[] = [];
    let updateImport = false;
    const f = {
      trackNode: function (node: ts.Node) {
        nodes.push({
          node,
          importNode: ts.isImportDeclaration(node),
        });
      },
      flagUpdateImport() {
        updateImport = true;
      },
    };
    traverse(sourceFile, f);

    const lines: string[] = [];
    for (const node of nodes) {
      if (updateImport && node.importNode) {
        const importNode = node.node as ts.ImportDeclaration;
        const transformedImport = transformImport(importNode, sourceFile);
        if (transformedImport) {
          lines.push(transformedImport);
          continue;
        }
      }

      lines.push(
        printer.printNode(ts.EmitHint.Unspecified, node.node, sourceFile),
      );
    }

    //    fs.writeFileSync(file, lines.join("\n"));
  });
}

interface File {
  trackNode(node: ts.Node): void;
  flagUpdateImport(): void;
}

interface NodeInfo {
  node: ts.Node;
  importNode?: boolean;
}

// TODO whitespace
// TODO "FieldMap"

function traverse(sourceFile: ts.SourceFile, f: File) {
  ts.forEachChild(sourceFile, function (node: ts.Node) {
    if (ts.isClassDeclaration(node)) {
      // TODO address implicit schema doesn't work here...
      //        console.debug(sourceFile.fileName, node.kind);
      if (traverseClass(sourceFile, node, f)) {
        f.flagUpdateImport();
        return;
      }
    }
    f.trackNode(node);
  });
}

// TODO need to replace class field member, print that and see what happens
function traverseClass(
  sourceFile: ts.SourceFile,
  node: ts.ClassDeclaration,
  f: File,
): boolean {
  //  ts.factory.createClassDeclaration(node.decorators, node.modifiers, node.name, node.pa);
  // create new class Declaration
  // class Member literati
  const exportedMembers: ts.ClassElement[] = [];
  let updated = false;
  for (const member of node.members) {
    if (!isFieldElement(member, sourceFile)) {
      exportedMembers.push(member);
      continue;
    }
    updated = true;
    // need to change to fields: FieldMap = {code: StringType()};
    const property = member as ts.PropertyDeclaration;
    const initializer = property.initializer as ts.ArrayLiteralExpression;
    // if not all changed, modify it also...
    // TODO...

    const fieldsProperties: ts.ObjectLiteralElementLike[] = [];

    for (const element of initializer.elements) {
      if (element.kind !== ts.SyntaxKind.CallExpression) {
        console.error("skipped non-call expression");
        continue;
      }
      let callEx = element as ts.CallExpression;
      if (callEx.arguments.length !== 1) {
        console.error("callExpression with arguments not of length 1");
        continue;
      }
      let arg = callEx.arguments[0];
      if (arg.kind !== ts.SyntaxKind.ObjectLiteralExpression) {
        console.error("not objectLiteralExpression");
        continue;
      }
      let expr = arg as ts.ObjectLiteralExpression;
      let name = "";
      let newProperties: ts.ObjectLiteralElementLike[] = [];
      for (const p of expr.properties) {
        const p2 = p as ts.PropertyAssignment;
        //        console.debug(p2.kind);
        // found name property
        if ((p2.name as ts.Identifier).escapedText === "name") {
          name = p2.initializer.getText(sourceFile);
        } else {
          newProperties.push(p);
          //          p2.initializer.
        }
      }
      if (!name) {
        console.error(`couldn't find name property`);
        continue;
      }
      // remove quotes
      name = name.slice(1, -1);

      if (newProperties.length) {
        console.debug(name, " still has properties");
        // update in terms of what's being called here...
        // if empty, we want to kill this...
        expr = ts.factory.updateObjectLiteralExpression(expr, newProperties);
        //        arg = ts.factory.updateArg
        callEx = ts.factory.updateCallExpression(
          callEx,
          callEx.expression,
          undefined,
          //
          [expr],
        );
      } else {
        console.debug(name, " no more properties");
        callEx = ts.factory.updateCallExpression(
          callEx,
          callEx.expression,
          undefined,
          //
          [],
        );
      }

      //      ts.factory.createPropertyAssignment(name, callEx);
      fieldsProperties.push(ts.factory.createPropertyAssignment(name, callEx));
      //ts.factory.createObjectLiteralExpression());
    }

    // TODO get existing decorators and modifiers
    // create new fields
    exportedMembers.push(
      ts.factory.createPropertyDeclaration(
        [],
        [],
        "fields",
        undefined,
        // TODO FieldMap here is in quotes. I don't want that...
        ts.factory.createLiteralTypeNode(
          ts.factory.createStringLiteral("FieldMap"),
        ),
        ts.factory.createObjectLiteralExpression(fieldsProperties),
        // arguments?
        //      undefined,
      ),
    );
  }

  const klass = ts.factory.createClassDeclaration(
    node.decorators,
    node.modifiers,
    node.name,
    node.typeParameters,
    node.heritageClauses,
    exportedMembers,
  );
  f.trackNode(klass);

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
  //console.debug(token.escapedText);

  if (property.initializer?.kind !== ts.SyntaxKind.ArrayLiteralExpression) {
    console.error("invalid array type");
    return false;
  }

  return true;
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

Promise.resolve(main());
