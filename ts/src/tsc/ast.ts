import ts from "typescript";

export function getPreText(
  fileContents: string,
  node: ts.Node,
  sourceFile: ts.SourceFile,
): string {
  return fileContents.substring(node.getFullStart(), node.getStart(sourceFile));
}

export interface ClassInfo {
  extends?: string;
  comment: string;
  name: string;
  export?: boolean;
  default?: boolean;
  //  implementsSchema?: boolean;
  implements?: string[];
  wrapClassContents(inner: string): string;
}

export function getClassInfo(
  fileContents: string,
  sourceFile: ts.SourceFile,
  node: ts.ClassDeclaration,
): ClassInfo | undefined {
  let className = node.name?.text;

  let classExtends: string | undefined;
  let impl: string[] = [];
  if (node.heritageClauses) {
    for (const hc of node.heritageClauses) {
      switch (hc.token) {
        case ts.SyntaxKind.ImplementsKeyword:
          for (const type of hc.types) {
            impl.push(type.expression.getText(sourceFile));
          }
          break;

        case ts.SyntaxKind.ExtendsKeyword:
          // can only extend one class
          for (const type of hc.types) {
            const text = type.expression.getText(sourceFile);
            classExtends = text;
          }
          break;
      }
    }
  }

  // we probably still don't need all of this...
  if (!className || !node.heritageClauses || !classExtends) {
    return undefined;
  }

  let hasExport = false;
  let hasDefault = false;
  let comment = getPreText(fileContents, node, sourceFile);

  const wrapClassContents = (inner: string) => {
    let ret = `${comment}`;
    if (hasExport) {
      ret += "export ";
    }
    if (hasDefault) {
      ret += "default ";
    }
    ret += `class ${className} `;
    if (classExtends) {
      ret += `extends ${classExtends} `;
    }
    if (impl.length) {
      ret += `implements ${impl.join(", ")}`;
    }

    return `${ret}{
      ${inner}
    }`;
  };

  if (node.modifiers) {
    for (const mod of node.modifiers) {
      const text = mod.getText(sourceFile);
      if (text === "export") {
        hasExport = true;
      } else if (text === "default") {
        hasDefault = true;
      }
    }
  }

  return {
    name: className,
    extends: classExtends,
    comment,
    implements: impl,
    wrapClassContents,
    export: hasExport,
    default: hasDefault,
  };
}
