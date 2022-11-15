import { TransformFile, transform } from "../tsc/transform";
import {
  getImportInfo,
  getCustomInfo,
  transformRelative,
  transformImport,
  isRelativeImport,
} from "../tsc/ast";
import ts, { isImportDeclaration } from "typescript";

class TransformImports implements TransformFile {
  glob = "src/**/*.test.ts";

  prettierGlob = "src/**/*.test.ts";

  impsToMove = new Map();
  cwd = "";
  relative = false;

  constructor() {
    this.cwd = process.cwd();
    const result = require("src/ent/generated/types");
    Object.keys(result).forEach((v) => this.impsToMove.set(v, true));

    this.relative = getCustomInfo().relativeImports ?? this.relative;
  }

  traverseChild(
    sourceFile: ts.SourceFile,
    contents: string,
    file: string,
    node: ts.Node,
  ) {
    if (!isImportDeclaration(node)) {
      return { node };
    }

    const impInfo = getImportInfo(node, sourceFile);
    if (!impInfo) {
      return { node };
    }
    const text = node.moduleSpecifier.getText(sourceFile).slice(1, -1);

    // let's see if we can simplify
    let seenImports: string[] = [];
    for (let imp of impInfo.imports) {
      imp = imp.trim();
      if (this.impsToMove.has(imp)) {
        seenImports.push(imp);
      }
    }

    const pathToWrite = transformRelative(
      file,
      "src/ent/generated/types",
      this.relative,
    );
    let current = text;
    if (isRelativeImport(node, sourceFile)) {
      current = transformRelative(file, text, this.relative);
    }

    // nothing to do here
    if (pathToWrite === current) {
      return { node };
    }

    if (!seenImports.length) {
      return { node };
    }

    let imports: Map<string, string[]> = new Map([[pathToWrite, seenImports]]);

    return {
      rawString: transformImport(contents, node, sourceFile, {
        removeImports: seenImports,
        transformPath: text,
      }),
      traversed: true,
      imports, // new imports to add
      allowSeenImportsAdded: true,
    };
  }
}

//  ts-node-script --swc --project ./tsconfig.json -r tsconfig-paths/register ../../ts/src/scripts/move_types.ts
function main() {
  transform(new TransformImports());
}

main();
