import { glob } from "glob";
import * as path from "path";
import * as fs from "fs";
import {
  createSourceFile,
  getTargetFromCurrentDir,
} from "../tsc/compilerOptions";
import ts from "typescript";
import { isRelativeGeneratedImport, updateImportPath } from "../tsc/ast";
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

function updateImports(files: string[], target: ts.ScriptTarget, cwd: string) {
  files.forEach((file) => {
    let { contents, sourceFile } = createSourceFile(target, file);

    let nodes: NodeInfo[] = [];

    let updated = false;
    ts.forEachChild(sourceFile, function (node: ts.Node) {
      let dirPath = path.join(cwd, file, "..");
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

    if (updated) {
      fs.writeFileSync(file, newContents);
    }
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

  // multi-step process
  // move files
  // then update imports...

  moveFiles(entFiles);
  moveFiles(graphqlFiles);

  const target = getTargetFromCurrentDir();

  const entImportFiles = glob.sync("src/ent/**/*.ts", {
    ignore: ["**/generated/**", "node_modules/**"],
  });
  const graphqlImportFiles = glob.sync("src/graphql/**/*.ts", {
    ignore: ["**/generated/**", "node_modules/**"],
  });

  const cwd = process.cwd();

  updateImports(entImportFiles, target, cwd);
  updateImports(graphqlImportFiles, target, cwd);

  execSync("prettier src/ent/**.ts --write");
  execSync("prettier src/graphql/**.ts --write");
}

function isGeneratedPath(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  dirPath: string,
) {
  // it's relative and has generated in there, continue
  if (!isRelativeGeneratedImport(node, sourceFile)) {
    return;
  }

  const text = node.moduleSpecifier.getText(sourceFile).slice(1, -1);
  const oldPath = path.join(dirPath, text);
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
