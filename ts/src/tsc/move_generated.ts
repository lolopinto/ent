import { glob } from "glob";
import * as path from "path";
import * as fs from "fs";
import ts from "typescript";
import {
  isRelativeGeneratedImport,
  isSrcGeneratedImport,
  updateImportPath,
} from "./ast";
import { transform, TransformFile } from "./transform";
import { load } from "js-yaml";
import { Config } from "../core/config";

class MoveFiles {
  constructor(private globPath: string) {}

  move() {
    const files = glob.sync(this.globPath);
    moveFiles(files);
  }
}

class TransformImports implements TransformFile {
  cwd: string;
  relativeImports = false;
  constructor(public glob: string, public prettierGlob: string) {
    this.cwd = process.cwd();
    this.relativeImports = relativeImports();
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

    const newImportPath = getNewImportPath(
      node,
      sourceFile,
      dirPath,
      this.relativeImports,
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

function relativeImports(): boolean {
  let yaml: Config | undefined = {};

  let relativeImports = false;
  try {
    yaml = load(
      fs.readFileSync(path.join(process.cwd(), "ent.yml"), {
        encoding: "utf8",
      }),
    ) as Config;

    relativeImports = yaml?.codegen?.relativeImports || false;

    return yaml?.codegen?.relativeImports || false;
  } catch (e) {}
  return false;
}

function getNewImportPath(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  dirPath: string,
  relativeImports: boolean,
) {
  // it's relative and has generated in there, continue
  const text = node.moduleSpecifier.getText(sourceFile).slice(1, -1);

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
  // if relative imports, we done.
  if (relativeImports) {
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

export function moveGenerated() {
  new MoveFiles("src/ent/**/generated/**/**.ts").move();
  new MoveFiles("src/graphql/**/generated/**/**.ts").move();

  transform(new TransformImports("src/ent/**/*.ts", "src/ent/**.ts"));
  transform(new TransformImports("src/graphql/**/*.ts", "src/graphql/**.ts"));
}
