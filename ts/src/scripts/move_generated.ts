import { glob } from "glob";
import * as path from "path";
import * as fs from "fs";
import {
  createSourceFile,
  getTarget,
  readCompilerOptions,
} from "../tsc/compilerOptions";
import ts from "typescript";
import { updateImportPath } from "../tsc/ast";
import { execSync } from "child_process";

// src/ent/generated and src/graphql/generated

function transformPath(old: string) {
  const parts = old.split(path.sep);
  if (parts.length < 3) {
    return;
  }

  const changedParts = parts
    .slice(0, 2)
    .concat("generated")
    .concat(parts.slice(2).filter((v) => v !== "generated"));

  const newFile = changedParts.join(path.sep);

  return { changedParts, newFile };
}

function moveFiles(files: string[]) {
  files.forEach((file) => {
    const conv = transformPath(file);
    if (!conv) {
      return;
    }
    const { changedParts, newFile } = conv;

    if (file === newFile) {
      return;
    }

    // check if directory exists, if not, create recursive dir
    const p = changedParts.slice(0, changedParts.length - 1).join(path.sep);
    const statInfo = fs.statSync(p, { throwIfNoEntry: false });
    if (!statInfo) {
      fs.mkdirSync(p, {
        recursive: true,
      });
    }

    // move file to new location
    fs.renameSync(file, newFile);
  });
}

// inspired by transform_schema
// TODO refactor...
interface NodeInfo {
  node?: ts.Node;
  rawString?: string;
}

function main() {
  const entFiles = glob.sync("src/ent/**/generated/**/**.ts");
  const graphqlFiles = glob.sync("src/graphql/**/generated/**/**.ts");

  moveFiles(entFiles);
  moveFiles(graphqlFiles);

  // TODO this sequence is repeated...
  const options = readCompilerOptions(".");
  const target = getTarget(options.target?.toString());

  const checkImports = glob.sync("src/ent/**/*.ts", {
    ignore: ["**/generated/**", "node_modules/**"],
  });
  const checkImports2 = glob.sync("src/graphql/**/*.ts", {
    ignore: ["**/generated/**", "node_modules/**"],
  });

  const cwd = process.cwd();

  // TODO move into func and run for checkImports
  checkImports.forEach((file) => {
    let { contents, sourceFile } = createSourceFile(target, file);

    let nodes: NodeInfo[] = [];

    let updated = false;
    ts.forEachChild(sourceFile, function (node: ts.Node) {
      let dirPath = path.join(cwd, file, "..");
      //      console.debug(dirPath);
      if (ts.isImportDeclaration(node)) {
        const conv = isGeneratedPath(node, sourceFile, dirPath);
        if (!conv) {
          nodes.push({ node });
          return;
        }
        updated = true;

        const newImportPath = path.relative(dirPath, conv.newFile);
        const v = updateImportPath(contents, node, sourceFile, newImportPath);
        nodes.push({ rawString: v });
      } else {
        nodes.push({ node });
      }
    });

    let newContents = "";
    for (const node of nodes) {
      if (node.node) {
        newContents += node.node.getFullText(sourceFile);
      } else if (node.rawString) {
        newContents += node.rawString;
      } else {
        throw new Error(`malformed node with no node or rawString`);
      }
    }

    fs.writeFileSync(file, newContents);
  });

  execSync("prettier src/ent/*.ts --write");
  execSync("prettier src/graphql/*.ts --write");
}

function isGeneratedPath(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  dirPath: string,
) {
  const text = node.moduleSpecifier.getText(sourceFile).slice(1, -1);

  if (text.indexOf("./generated") === -1) {
    return;
  }
  const oldPath = path.join(dirPath, text);
  //        oldPath = path.re
  const relFromRoot = path.relative(".", oldPath);
  const conv = transformPath(relFromRoot);
  if (!conv) {
    return;
  }
  if (relFromRoot === conv.newFile) {
    return;
  }
  return conv;
}

main();
