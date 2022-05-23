import { glob } from "glob";
import ts from "typescript";
import {
  readCompilerOptions,
  getTarget,
  createSourceFile,
} from "../tsc/compilerOptions";
import { getClassInfo } from "../tsc/ast";
import { execSync } from "child_process";
import * as fs from "fs";

async function main() {
  const options = readCompilerOptions(".");
  let files = glob.sync("src/ent/*.ts");
  const target = getTarget(options.target?.toString());

  files.forEach((file) => {
    // go through the file and print everything back if not starting immediately after other position
    let { contents, sourceFile } = createSourceFile(target, file);

    let newContents = "";
    let traversed = false;
    ts.forEachChild(sourceFile, function (node: ts.Node) {
      if (!ts.isClassDeclaration(node) || !node.heritageClauses) {
        newContents += node.getFullText(sourceFile);
        return;
      }

      // TODO need to move all of this into a function so it's clear where we start doing things
      if (!node.heritageClauses) {
        return;
      }
      const klass = node.name?.getFullText(sourceFile).trim();
      if (!klass) {
        return;
      }

      const bases = node.heritageClauses
        .filter((hc) => hc.token === ts.SyntaxKind.ExtendsKeyword)
        .map((hc) =>
          hc.types.map((type) => type.expression.getText(sourceFile)),
        )
        // @ts-ignore why is this missing?
        .flat(1);
      if (bases.length !== 1) {
        return;
      }

      if (bases[0] !== klass + "Base") {
        return;
      }

      let classInfo = getClassInfo(contents, sourceFile, node);
      if (!classInfo) {
        return;
      }

      traversed = true;

      // TODO add comments
      // add class export class User etc...
      let klassContents = "";
      for (const mm of node.members) {
        if (isPrivacyPolicy(mm)) {
          const property = mm as ts.PropertyDeclaration;
          const initializer =
            property.initializer as ts.ObjectLiteralExpression;
          const pp = initializer.getFullText(sourceFile);
          const code = `getPrivacyPolicy(): PrivacyPolicy<this> {
            return ${pp}
          }`;
          //          console.debug(klass, code);
          klassContents += code;
        } else {
          klassContents += mm.getFullText(sourceFile);
          //          console.debug(mm.getFullText(sourceFile));
          // TODO...
        }
      }
      newContents += classInfo.wrapClassContents(klassContents);
      //      console.debug(klass, node.members.length);

      // const pp = node.members.filter((mm) => {
      //   const v =
      //     mm.kind === ts.SyntaxKind.PropertyDeclaration &&
      //     (mm.name as ts.Identifier).escapedText === "privacyPolicy";
      //   if (!v) {
      //     return false;
      //   }
      //   const property = mm as ts.PropertyDeclaration;
      //   return (
      //     property.initializer?.kind === ts.SyntaxKind.ObjectLiteralExpression
      //   );
      // });
      // if (pp.length !== 1) {
      //   return;
      // }
      //      console.debug(pp);
    });

    if (traversed) {
      fs.writeFileSync(file, newContents);
      //      console.debug(newContents);
    }
  });

  execSync("prettier src/ent/*.ts --write");
}

function isPrivacyPolicy(mm: ts.ClassElement) {
  const v =
    mm.kind === ts.SyntaxKind.PropertyDeclaration &&
    (mm.name as ts.Identifier).escapedText === "privacyPolicy";
  if (!v) {
    return false;
  }
  // doesn't have to eb objectliteral
  const property = mm as ts.PropertyDeclaration;
  return property.initializer?.kind === ts.SyntaxKind.ObjectLiteralExpression;
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
