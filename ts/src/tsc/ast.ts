import { Data } from "../core/base";
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

  if (!className) {
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

type transformImportFn = (imp: string) => string;

interface transformOpts {
  removeImports?: string[];
  newImports?: string[];
  transform?: transformImportFn;
  transformPath?: string;
}

export function transformImport(
  fileContents: string,
  importNode: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  opts?: transformOpts,
): string | undefined {
  // remove quotes too
  const text = importNode.moduleSpecifier.getText(sourceFile).slice(1, -1);
  if (opts?.transformPath) {
    if (text !== opts.transformPath) {
      return;
    }
  } else {
    if (
      text !== "@snowtop/ent" &&
      text !== "@snowtop/ent/schema" &&
      text !== "@snowtop/ent/schema/"
    ) {
      return;
    }
  }
  const impInfo = getImportInfo(importNode, sourceFile);
  if (!impInfo) {
    return;
  }
  const { imports, start, end, importText } = impInfo;

  let removeImportsMap: Data = {};
  if (opts?.removeImports) {
    opts.removeImports.forEach((imp) => (removeImportsMap[imp] = true));
  }
  let finalImports = new Set<string>();

  for (let i = 0; i < imports.length; i++) {
    let imp = imports[i].trim();
    if (imp === "") {
      continue;
    }
    if (opts?.transform) {
      imp = opts.transform(imp);
    }
    if (removeImportsMap[imp]) {
      continue;
    }
    finalImports.add(imp);
  }
  if (opts?.newImports) {
    opts.newImports.forEach((imp) => finalImports.add(imp));
  }

  const comment = getPreText(fileContents, importNode, sourceFile);

  return (
    comment +
    "import " +
    importText.substring(0, start + 1) +
    Array.from(finalImports).join(", ") +
    importText.substring(end) +
    ' from "' +
    text +
    '";'
  );
}

export function updateImportPath(
  fileContents: string,
  importNode: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  newPath: string,
) {
  const comment = getPreText(fileContents, importNode, sourceFile);

  // all this copied from above...
  const importText = importNode.importClause?.getText(sourceFile) || "";
  const start = importText.indexOf("{");
  const end = importText.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return;
  }
  const imports = importText
    .substring(start + 1, end)
    //    .trim()
    .split(",");

  return (
    comment +
    "import " +
    importText.substring(0, start + 1) +
    Array.from(imports).join(", ") +
    importText.substring(end) +
    ' from "' +
    newPath +
    '";'
  );
}

export function isRelativeImport(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
) {
  const text = node.moduleSpecifier.getText(sourceFile).slice(1, -1);
  return text.startsWith("..") || text.startsWith("./");
}

export function isRelativeGeneratedImport(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
) {
  const text = node.moduleSpecifier.getText(sourceFile).slice(1, -1);
  return (
    (text.startsWith("..") || text.startsWith("./")) &&
    text.indexOf("/generated") !== -1
  );
}

interface importInfo {
  imports: string[];
  start: number;
  end: number;
  importText: string;
  importPath: string;
}

export function getImportInfo(
  imp: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
): importInfo | undefined {
  const importText = imp.importClause?.getText(sourceFile) || "";
  const start = importText.indexOf("{");
  const end = importText.lastIndexOf("}");
  const text = imp.moduleSpecifier.getText(sourceFile).slice(1, -1);

  if (start === -1 || end === -1) {
    return;
  }
  return {
    importPath: text,
    importText,
    start,
    end,
    imports: importText
      .substring(start + 1, end)
      //.trim()
      .split(","),
  };
}
