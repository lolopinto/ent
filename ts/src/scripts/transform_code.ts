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
    let { contents, sourceFile } = createSourceFile(target, file);

    let newContents = "";
    let traversed = false;
    ts.forEachChild(sourceFile, function (node: ts.Node) {
      if (!ts.isClassDeclaration(node) || !node.heritageClauses) {
        newContents += node.getFullText(sourceFile);
        return;
      }

      let classInfo = getClassInfo(contents, sourceFile, node);
      // only do classes which extend a base class e.g. User extends UserBase
      if (!classInfo || classInfo.extends !== classInfo.name + "Base") {
        return;
      }

      // need to check for PrivacyPolicy import...
      traversed = true;

      let klassContents = "";
      for (const mm of node.members) {
        if (isPrivacyPolicy(mm)) {
          const property = mm as ts.PropertyDeclaration;
          // if invalid privacy policy, bounce
          if (!property.initializer) {
            traversed = false;
            return;
          }
          const pp = property.initializer.getFullText(sourceFile);
          const code = `getPrivacyPolicy(): PrivacyPolicy<this> {
            return ${pp}
          }`;
          klassContents += code;
        } else {
          klassContents += mm.getFullText(sourceFile);
        }
      }
      // wrap comments and transform to export class Foo extends Bar { ${inner} }
      newContents += classInfo.wrapClassContents(klassContents);
    });

    // if traversed, overwrite.
    if (traversed) {
      fs.writeFileSync(file, newContents);
    }
  });

  execSync("prettier src/ent/*.ts --write");
}

function isPrivacyPolicy(mm: ts.ClassElement) {
  return (
    mm.kind === ts.SyntaxKind.PropertyDeclaration &&
    (mm.name as ts.Identifier).escapedText === "privacyPolicy"
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
