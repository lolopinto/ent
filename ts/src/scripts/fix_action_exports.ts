import { getClassInfo } from "../tsc/ast.js";
import { TransformFile, transform } from "../tsc/transform.js";
import ts, { SourceFile, Node, isClassDeclaration } from "typescript";

class FixActionExports implements TransformFile {
  glob = "src/ent/**/actions/*_action.ts";

  prettierGlob = "src/ent/**/actions/*_action.ts";

  traverseChild(
    sourceFile: SourceFile,
    contents: string,
    file: string,
    node: Node,
  ) {
    if (!isClassDeclaration(node)) {
      return { node };
    }
    // only Action classes
    if (!node.name?.text.endsWith("Action")) {
      return { node };
    }

    const modifiers = ts.canHaveModifiers(node)
      ? ts.getModifiers(node)
      : undefined;

    const exported = modifiers?.filter(
      (mod) => mod.getText(sourceFile) === "export",
    );
    const defaultExport = modifiers?.filter(
      (mod) => mod.getText(sourceFile) === "default",
    );

    // for now, we're only supporting changing from default -> non-default
    // trivial to support the other way around but don't need it yet
    if (!exported?.length || !defaultExport?.length) {
      return { node };
    }

    let classInfo = getClassInfo(contents, sourceFile, node, {
      hasExport: true,
      hasDefault: false,
    });

    if (!classInfo) {
      // somehow don't have classInfo, bye
      return { node };
    }

    let klassContents = "";
    for (const mm of node.members) {
      klassContents += mm.getFullText(sourceFile);
    }

    return {
      traversed: true,
      rawString: classInfo.wrapClassContents(klassContents),
    };
  }
}

// ts-node-script --swc --project ./tsconfig.json -r tsconfig-paths/register ../../ts/src/scripts/fix_action_exports.ts
function main() {
  const f = new FixActionExports();
  transform(f);
}

main();
