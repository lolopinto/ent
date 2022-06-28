import ts from "typescript";
import { getClassInfo, getPreText } from "./ast";
import { TransformFile } from "./transform";

function isPrivacyPolicy(mm: ts.ClassElement) {
  return (
    mm.kind === ts.SyntaxKind.PropertyDeclaration &&
    (mm.name as ts.Identifier).escapedText === "privacyPolicy"
  );
}

export class TransformEnt implements TransformFile {
  glob = "src/ent/*.ts";

  traverseChild(
    sourceFile: ts.SourceFile,
    contents: string,
    file: string,
    node: ts.Node,
  ) {
    if (!ts.isClassDeclaration(node) || !node.heritageClauses) {
      return { node };
    }

    let classInfo = getClassInfo(contents, sourceFile, node);
    if (!classInfo) {
      return;
    }
    // different class. ignore
    // only do classes which extend a base class e.g. User extends UserBase
    // if different class (e.g. privacy rule), just return it
    if (classInfo.extends !== classInfo.name + "Base") {
      return { node };
    }

    let klassContents = "";
    let traversed = false;

    for (const mm of node.members) {
      if (isPrivacyPolicy(mm)) {
        const property = mm as ts.PropertyDeclaration;
        // if invalid privacy policy, bounce
        if (!property.initializer) {
          return;
        }
        const pp = property.initializer.getFullText(sourceFile);
        const code = `getPrivacyPolicy(): PrivacyPolicy<this> {
            return ${pp}
          }`;
        klassContents += getPreText(contents, mm, sourceFile) + code;
        traversed = true;
      } else {
        klassContents += mm.getFullText(sourceFile);
      }
    }

    return {
      rawString: classInfo.wrapClassContents(klassContents),
      traversed,
      imports: new Map<string, string[]>([["@snowtop/ent", ["PrivacyPolicy"]]]),
    };
  }

  prettierGlob = "src/ent/*.ts";
}
