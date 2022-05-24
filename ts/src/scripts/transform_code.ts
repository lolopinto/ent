import { glob } from "glob";
import ts from "typescript";
import {
  readCompilerOptions,
  getTarget,
  createSourceFile,
} from "../tsc/compilerOptions";
import { getClassInfo, getPreText, transformImport } from "../tsc/ast";
import { execSync } from "child_process";
import * as fs from "fs";

// inspired by transform_schema
interface NodeInfo {
  node?: ts.Node;
  rawString?: string;
}

async function main() {
  const options = readCompilerOptions(".");
  let files = glob.sync("src/ent/*.ts");
  const target = getTarget(options.target?.toString());

  files.forEach((file) => {
    let { contents, sourceFile } = createSourceFile(target, file);

    let traversed = false;
    let nodes: NodeInfo[] = [];

    ts.forEachChild(sourceFile, function (node: ts.Node) {
      if (!ts.isClassDeclaration(node) || !node.heritageClauses) {
        nodes.push({ node });
        return;
      }

      let classInfo = getClassInfo(contents, sourceFile, node);
      // only do classes which extend a base class e.g. User extends UserBase
      if (!classInfo || classInfo.extends !== classInfo.name + "Base") {
        return;
      }
      if (classInfo.name !== "ContactEmail") {
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
      nodes.push({ rawString: classInfo.wrapClassContents(klassContents) });
      //      console.debug(classInfo.wrapClassContents(klassContents));
    });

    // if traversed, overwrite.
    if (!traversed) {
      return;
    }

    let newContents = "";
    for (const node of nodes) {
      if (node.node) {
        if (ts.isImportDeclaration(node.node)) {
          let transformed = transformImport(contents, node.node, sourceFile, {
            newImports: ["PrivacyPolicy"],
          });
          if (transformed) {
            newContents += transformed;
            continue;
          }
        }
        newContents += node.node.getFullText(sourceFile);
      } else if (node.rawString) {
        newContents += node.rawString;
      } else {
        throw new Error(`malformed node with no node or rawString`);
      }

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
