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
  files = files.filter((f) => f.endsWith("event.ts"));

  files.forEach((file) => {
    let contents = fs.readFileSync(file).toString();

    // go through the file and print everything back if not starting immediately after other position
    const sourceFile = ts.createSourceFile(
      file,
      contents,
      target,
      false, // when this is true, it breaks string literals for some reason...
      ts.ScriptKind.TS,
    );
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const nodes: NodeInfo[] = [];
    let updateImport = false;
    const f = {
      trackNode: function (tni: TrackNodeInfo) {
        nodes.push({
          node: tni.node,
          importNode: tni.node && ts.isImportDeclaration(tni.node),
          newNode: tni.newNode,
          // removing preNode and using comment "works"
          // but loses space
          // so the comment route just doesn't work...
          preNode: tni.preNode,
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
          newContents += transformedImport + "\n";
          continue;
        }
      }
      if (node.preNode) {
        newContents += node.preNode;
      }

      let printFile = sourceFile;
      if (node.newNode) {
        // TODO handle in file...
        // new source file for new node for printing...
        // next step is to maybe send strings here instead of this so that we do the whitespace in there?
        printFile = ts.createSourceFile(
          "someFileName.ts",
          "",
          ts.ScriptTarget.Latest,
          false,
          ts.ScriptKind.TS,
        );
      }
      if (node.node) {
        newContents +=
          printer.printNode(ts.EmitHint.Unspecified, node.node, printFile) +
          "\n";
      } else if (node.rawString) {
        newContents += node.rawString;
      } else {
        console.error("invalid node");
      }
    }
    //    console.debug(newContents);

    // TODO
    fs.writeFileSync("src/schema/event2.ts", newContents);
  });

  execSync("prettier src/schema/*.ts --write");
}

interface File {
  trackNode(tn: TrackNodeInfo): void;
  flagUpdateImport(): void;
}

interface TrackNodeInfo {
  node?: ts.Node;
  preNode?: string;
  newNode?: boolean;
  rawString?: string;
}

interface NodeInfo {
  node?: ts.Node;
  importNode?: boolean;
  newNode?: boolean;
  preNode?: string;
  rawString?: string;
}

function traverse(
  fileContents: string,
  sourceFile: ts.SourceFile,
  f: File,
): boolean {
  let lastEnd = -1;
  let traversed = false;
  ts.forEachChild(sourceFile, function (node: ts.Node) {
    visitEachChild(sourceFile, node);

    const start = node.getStart(sourceFile);
    const preNode = fileContents.substring(lastEnd + 1, start);
    lastEnd = node.end;
    if (ts.isClassDeclaration(node)) {
      traversed = true;
      // TODO address implicit schema doesn't work here...
      //        console.debug(sourceFile.fileName, node.kind);
      if (traverseClass(fileContents, sourceFile, node, f)) {
        f.flagUpdateImport();
        return;
      }
    }
    f.trackNode({ node, preNode });
  });
  return traversed;
}

function print(node: ts.Node, sourceFile: ts.SourceFile) {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const printFile = ts.createSourceFile(
    "someFileName.ts",
    "",
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
  // console.debug(
  //   printer.printNode(ts.EmitHint.Unspecified, node, printFile) + "\n",
  // );

  // instead of nodes, just grab entire strings and parse...
  // now the only thing is to print the export default class line correctly...

  // node.forEachChild((c) => {
  //   console.debug(
  //     c.getStart(sourceFile),
  //     c.getFullStart(),
  //     c.getText(sourceFile),
  //   );
  // });
}

// TODO need to replace class field member, print that and see what happens
function traverseClass(
  fileContents: string,
  sourceFile: ts.SourceFile,
  node: ts.ClassDeclaration,
  f: File,
): boolean {
  //  ts.factory.createClassDeclaration(node.decorators, node.modifiers, node.name, node.pa);
  // create new class Declaration
  // class Member literati
  const exportedMembers: ts.ClassElement[] = [];
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

    // fieldMapComment...
    const comment = getPreText(fileContents, member, sourceFile);
    // just need to take this comment and add to pritned node later...
    // TODO comment
    //    console.debug(comment);

    updated = true;
    // need to change to fields: FieldMap = {code: StringType()};
    const property = member as ts.PropertyDeclaration;
    const initializer = property.initializer as ts.ArrayLiteralExpression;
    // if not all changed, modify it also...
    // TODO...

    const fieldsProperties: ts.ObjectLiteralElementLike[] = [];

    let fieldMap = "\nfields: FieldMap = {";
    for (const element of initializer.elements) {
      let properties: string[] = [];

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
          // get property definition
          properties.push(p.getFullText(sourceFile));
          // newProperties.push(p);
          // console.debug(p.getFullText(sourceFile));
          //          properties.
          //          p2.initializer.
        }
        // const propertyComment = getPreText(fileContents, p, sourceFile).trim();
        // // TODO doesn't grab the even more nested so work on strings instead....
        // if (propertyComment) {
        //   //          console.debug("propertyComment", propertyComment);
        // }
      }
      if (!name) {
        console.error(`couldn't find name property`);
        continue;
      }
      // remove quotes
      name = name.slice(1, -1);
      //      console.debug(element.getStart(sourceFile), element.getFullStart());
      // TODO comments and extra stuff. add comment

      const fieldComment = getPreText(fileContents, element, sourceFile).trim();
      if (fieldComment) {
        console.debug("fieldComment", fieldComment);
      }

      let call = callEx.expression.getText(sourceFile);
      //      console.debug(name, call);
      //      console.debug(callEx.expression.getText(sourceFile));
      let fnCall = "";
      if (properties.length) {
        fnCall = `{${properties.join(",")}}`;
      }
      //      console.debug(name, call, fnCall);
      let property = `${name}:${call}(${fnCall}),`;
      if (fieldComment) {
        //        console.debug(fieldComment);
        //        property = fieldComment + property;
      }
      //      console.debug(property, "\n");
      fieldMap += property;
      //      console.debug(property);

      if (newProperties.length) {
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
    fieldMap += "}";
    klassContents += fieldMap;

    // create new fields of type FieldMap
    const newFieldMap = ts.factory.createPropertyDeclaration(
      member.decorators,
      member.modifiers,
      "fields",
      undefined,
      ts.factory.createTypeReferenceNode("FieldMap"),
      ts.factory.createObjectLiteralExpression(fieldsProperties),
      // arguments?
      //      undefined,
    );
    // const printFile = ts.createSourceFile(
    //   "someFileName.ts",
    //   "",
    //   ts.ScriptTarget.Latest,
    //   false,
    //   ts.ScriptKind.TS,
    // );
    // const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    // console.debug(
    //   printer.printNode(ts.EmitHint.Unspecified, newFieldMap, printFile),
    // );

    // need to grab other comments and use them here
    //    visitEachChild(sourceFile, newFieldMap);
    exportedMembers.push(newFieldMap);
  }

  klassContents += "\n}";

  //  console.debug(klassContents);

  if (!updated) {
    return updated;
  }

  // TODO need to change this to get whitespace btw members
  // same logic as we do btw top-level-statements
  // TODO need to change to postNode instead of preNode?
  // const klass = ts.factory.updateClassDeclaration(
  //   node,
  //   node.decorators,
  //   node.modifiers,
  //   node.name,
  //   node.typeParameters,
  //   node.heritageClauses,
  //   exportedMembers,
  // );
  f.trackNode({ newNode: true, rawString: klassContents });

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

// to keep track of ranges since comments show up multiple times
let visited: any = {};

function visitEachChild(sourceFile: ts.SourceFile, node: ts.Node) {
  return;
  //console.debug(ts.getLeadingCommentRanges(sourceFile.getFullText(), 0));

  function visit(n: ts.Node) {
    if (ts.isStringLiteral(n)) {
      //      console.debug("litera");
      //      return;
    }
    const start = node.getFullStart();
    if (visited[start]) {
      return;
    }
    const commentRanges = ts.getLeadingCommentRanges(
      sourceFile.getFullText(),
      start,
    );
    visited[start] = true;

    if (commentRanges) {
      commentRanges.map((r) => {
        const text = sourceFile.getFullText().slice(r.pos, r.end);
        console.debug(node.getFullStart(), text);
        //        console.debug(n.getFullText(sourceFile), text);
        // TODO need to strip // or /*
        ts.addSyntheticLeadingComment(n, r.kind, text, r.hasTrailingNewLine);
      });
    }
    visitEachChild(sourceFile, n);
    //    ts.forEachChild(n, visit);
    //    ts.forEachChild;
  }
  visit(node);
}

function getPreText(
  fileContents: string,
  node: ts.Node,
  sourceFile: ts.SourceFile,
): string {
  return fileContents.substring(node.getFullStart(), node.getStart(sourceFile));
}

Promise.resolve(main());
