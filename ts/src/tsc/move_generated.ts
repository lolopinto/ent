import { glob } from "glob";
import * as path from "path";
import * as fs from "fs";
import ts from "typescript";
import { isRelativeGeneratedImport, updateImportPath } from "./ast";
import { transform, TransformFile } from "./transform";

class MoveFiles {
  constructor(private globPath: string) {}

  move() {
    const files = glob.sync(this.globPath);
    moveFiles(files);
  }
}

class TransformImports implements TransformFile {
  cwd: string;
  constructor(public glob: string, public prettierGlob: string) {
    this.cwd = process.cwd();
  }

  globOptions = {
    ignore: ["**/generated/**", "node_modules/**"],
  };

  traverseChild(
    sourceFile: ts.SourceFile,
    contents: string,
    file: string,
    node: ts.Node,
  ) {
    if (!ts.isImportDeclaration(node)) {
      return { node };
    }
    let dirPath = path.join(this.cwd, file, "..");

    const conv = isGeneratedPath(node, sourceFile, dirPath);
    if (!conv) {
      return { node };
    }

    const newImportPath = path.relative(dirPath, conv.newFile);
    const v = updateImportPath(contents, node, sourceFile, newImportPath);

    return {
      traversed: true,
      rawString: v,
    };
  }
}

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

export function moveGenerated() {
  new MoveFiles("src/ent/**/generated/**/**.ts").move();
  new MoveFiles("src/graphql/**/generated/**/**.ts").move();

  transform(new TransformImports("src/ent/**/*.ts", "src/ent/**.ts"));
  transform(new TransformImports("src/graphql/**/*.ts", "src/graphql/**.ts"));
}
