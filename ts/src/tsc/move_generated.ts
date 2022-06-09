import { glob } from "glob";
import * as path from "path";
import * as fs from "fs";
import ts from "typescript";
import {
  isRelativeGeneratedImport,
  isRelativeImport,
  isSrcGeneratedImport,
  updateImportPath,
} from "./ast";
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
  constructor(
    public glob: string,
    public prettierGlob: string,
    private relativeImports: boolean,
    private checkRelativeImportsValid?: boolean,
  ) {
    this.cwd = process.cwd();
  }

  globOptions = {
    ignore: ["node_modules/**"],
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

    const newImportPath = this.getNewImportPath(
      node,
      file,
      sourceFile,
      dirPath,
    );
    if (!newImportPath) {
      return { node };
    }

    const v = updateImportPath(contents, node, sourceFile, newImportPath);

    return {
      traversed: true,
      rawString: v,
    };
  }

  getNewImportPath(
    node: ts.ImportDeclaration,
    file: string,
    sourceFile: ts.SourceFile,
    dirPath: string,
  ) {
    const text = node.moduleSpecifier.getText(sourceFile).slice(1, -1);

    // it's relative and has generated in there, continue
    // do relative imports path regardless of if relative imports is on or not
    if (isRelativeGeneratedImport(node, sourceFile)) {
      const oldPath = path.join(dirPath, text);
      const relFromRoot = path.relative(".", oldPath);
      const conv = transformPath(relFromRoot);
      if (!conv || conv.newFile === relFromRoot) {
        return;
      }
      return path.relative(dirPath, conv.newFile);
    }

    if (this.checkRelativeImportsValid && isRelativeImport(node, sourceFile)) {
      const parts = file.split(path.sep);
      if (
        parts.length === 5 &&
        parts.slice(0, 3).join(path.sep) ===
          ["src", "graphql", "generated"].join(path.sep)
      ) {
        // we have custom graphql import paths
        // src/graphql/generated/mutations|resolvers/foo_type.ts
        // which used to be
        // src/graphql/mutations|resolvers/generated/foo_type.ts

        // we probably have a broken import.
        // try and fix it...
        let temp = parts[2];
        parts[2] = parts[3];
        parts[3] = temp;
        const oldPath = parts.join(path.sep);

        let oldDir = path.join(this.cwd, oldPath, "..");
        let importPath = path.join(oldDir, text);
        let exists = fs.statSync(importPath + ".ts", { throwIfNoEntry: false });
        if (!exists) {
          // doesn't exist. sadly has to be fixed manually. could theoretically also be a directory but we shouldn't have that
          return;
        }

        return path.relative(dirPath, importPath);
      }
    }
    // if relative imports, we done.
    if (this.relativeImports) {
      return;
    }

    // non relative, only transform src paths with generated
    if (isSrcGeneratedImport(node, sourceFile)) {
      const conv = transformPath(text);
      if (!conv || conv.newFile === text) {
        return;
      }
      return conv.newFile;
    }

    return;
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

export function moveGenerated(relativeImports: boolean) {
  new MoveFiles("src/ent/**/generated/**/**.ts").move();
  new MoveFiles("src/graphql/**/generated/**/**.ts").move();

  transform(
    new TransformImports("src/ent/**/*.ts", "src/ent/**/*.ts", relativeImports),
  );
  transform(
    new TransformImports(
      "src/graphql/**/*.ts",
      "src/graphql/**/*.ts",
      relativeImports,
      true,
    ),
  );
}
