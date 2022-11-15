import { TransformFile, transform } from "../tsc/transform";
import {
  getImportInfo,
  getCustomInfo,
  transformRelative,
  transformImport,
} from "../tsc/ast";
import ts, { isImportDeclaration } from "typescript";

class GatherExportsInGeneratedTypes implements TransformFile {
  glob = "src/ent/generated/types.ts";
  names: string[] = [];
  traverseChild(
    sourceFile: ts.SourceFile,
    contents: string,
    file: string,
    node: ts.Node,
  ) {
    const exported = node.modifiers?.filter(
      (mod) => mod.getText(sourceFile) === "export",
    );

    if (exported?.length) {
      if (
        ts.isEnumDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node)
      ) {
        this.names.push(node.name.text);
      }

      if (ts.isFunctionDeclaration(node) && node.name?.text) {
        this.names.push(node.name.text);
      }
    }
    return { node };
  }
}

class TransformImports implements TransformFile {
  glob = "src/**/*.ts";

  prettierGlob = "src/**/*.ts";

  impsToMove = new Map();
  cwd = "";
  relative = false;

  constructor() {
    this.cwd = process.cwd();
    const gt = new GatherExportsInGeneratedTypes();
    transform(gt);
    gt.names.forEach((v) => this.impsToMove.set(v, true));

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
    const current = transformRelative(file, text, this.relative);

    // nothing to do here
    if (pathToWrite === current || !seenImports.length) {
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
