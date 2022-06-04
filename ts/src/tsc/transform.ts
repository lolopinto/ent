import { glob } from "glob";
import ts from "typescript";
import { execSync } from "child_process";
import * as fs from "fs";
import { getImportInfo, transformImport } from "./ast";
import { createSourceFile, getTargetFromCurrentDir } from "./compilerOptions";

type transformImportFn = (imp: string) => string;

interface TraverseChildResponse {
  // keep this node, nothing to do here
  node?: ts.Node;

  // main change we're doing here, transforming file
  rawString?: string;

  // if this is true, overwrite the file
  traversed?: boolean;

  // imports to change
  imports?: Map<string, string[]>;

  removeImports?: string[];

  transform?: transformImportFn;
}

interface NodeInfo {
  node?: ts.Node;
  rawString?: string;
}

export interface TransformFile {
  glob: string;
  // constructor...
  //  preprocess(): void;
  preprocessFile?: (
    contents: string,
    file: string,
    sourceFile: ts.SourceFile,
  ) => boolean;
  // ts.Node,
  traverseChild(
    sourceFile: ts.SourceFile,
    contents: string,
    file: string,
    node: ts.Node,
  ): TraverseChildResponse | undefined;

  filter?(files: string[]): string[];

  fileToWrite?(file: string): string;

  postProcess?(file: string): void;

  prettierGlob?: string;
}

function normalizePath(p: string) {
  if (p.endsWith("..")) {
    return p + "/";
  }
  return p;
}

export function transform(transform: TransformFile) {
  let files = glob.sync(transform.glob);
  const target = getTargetFromCurrentDir();
  if (transform.filter) {
    files = transform.filter(files);
  }

  files.forEach((file) => {
    let { contents, sourceFile } = createSourceFile(target, file);

    let nodes: NodeInfo[] = [];

    let imports: Map<string, string[]> = new Map();
    let removeImports: string[] = [];
    let traversed = false;
    let transformFn: transformImportFn | undefined = undefined;

    ts.forEachChild(sourceFile, function (node: ts.Node) {
      const ret = transform.traverseChild(sourceFile, contents, file, node);
      if (!ret) {
        return;
      }
      if (ret.node || ret.rawString) {
        nodes.push(ret);
      }

      if (ret.imports) {
        for (const [k, v] of ret.imports) {
          imports.set(k, v);
        }
      }
      if (ret.traversed) {
        traversed = ret.traversed;
      }

      if (ret.removeImports?.length) {
        removeImports.push(...ret.removeImports);
      }
      if (ret.transform) {
        transformFn = ret.transform;
      }
    });

    if (!traversed) {
      return;
    }

    let newContents = "";
    let afterProcessed = false;

    let seen = new Map<string, boolean>();

    const processAfterImport = () => {
      // do this for the first non-import node we see
      // we want to add new imports to end of imports and there's an assumption that imports are ordered
      // at top of file
      if (!afterProcessed) {
        for (const [imp, list] of imports) {
          if (seen.has(imp)) {
            continue;
          }
          newContents += `\nimport { ${list.join(", ")} } from "${imp}"`;
        }
        afterProcessed = true;
      }
    };

    for (const node of nodes) {
      if (node.node) {
        if (ts.isImportDeclaration(node.node)) {
          const impInfo = getImportInfo(node.node, sourceFile);
          if (impInfo) {
            const impPath = normalizePath(impInfo.importPath);

            // default transform. used by schema
            if (imports.size === 0) {
              const transformedImport = transformImport(
                contents,
                node.node,
                sourceFile,
                {
                  removeImports,
                  transform: transformFn,
                },
              );
              if (transformedImport) {
                newContents += transformedImport;
                continue;
              }
            } else {
              // transform list of imports.
              // used by
              // normalize paths...
              const list = imports.get(impPath);
              if (list) {
                let transformed = transformImport(
                  contents,
                  node.node,
                  sourceFile,
                  {
                    newImports: list,
                    // don't use normalized path here, we wanna use the path that's in code...
                    transformPath: impInfo.importPath,
                  },
                );
                if (transformed) {
                  newContents += transformed;
                  seen.set(impPath, true);
                  continue;
                }
              }
            }
          }
        } else {
          if (!ts.isExportDeclaration(node.node)) {
            processAfterImport();
          }
        }
        newContents += node.node.getFullText(sourceFile);
      } else if (node.rawString) {
        processAfterImport();
        newContents += node.rawString;
      } else {
        throw new Error(`malformed node with no node or rawString`);
      }
    }

    let writeFile = file;
    if (transform.fileToWrite) {
      writeFile = transform.fileToWrite(file);
    }
    // TODO new file
    fs.writeFileSync(writeFile, newContents);

    if (transform.postProcess) {
      transform.postProcess(file);
    }
  });

  if (transform.prettierGlob) {
    execSync(`prettier ${transform.prettierGlob} --write`);
  }
}
