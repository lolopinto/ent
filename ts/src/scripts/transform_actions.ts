import { glob } from "glob";
import ts from "typescript";
import {
  getTargetFromCurrentDir,
  createSourceFile,
} from "../tsc/compilerOptions";
import {
  getClassInfo,
  getImportInfo,
  getPreText,
  isRelativeGeneratedImport,
  transformImport,
} from "../tsc/ast";
import { execSync } from "child_process";
import * as fs from "fs";
import { Action, WriteOperation } from "../action";
import { LoggedOutViewer } from "../core/viewer";
import * as path from "path";
import { load } from "js-yaml";
import { Config } from "../core/config";

// inspired by transform_schema
interface NodeInfo {
  node?: ts.Node;
  rawString?: string;
}

function transformRelative(
  file: string,
  importPath: string,
  relative?: boolean,
): string {
  if (!relative || !importPath.startsWith("src")) {
    return importPath;
  }

  const fileFullPath = path.join(process.cwd(), file);
  const impFullPath = path.join(process.cwd(), importPath);
  // relative path is from directory
  return normalizePath(path.relative(path.dirname(fileFullPath), impFullPath));
}

function normalizePath(p: string) {
  if (p.endsWith("..")) {
    return p + "/";
  }
  return p;
}

function findInput(file: string, sourceFile: ts.SourceFile): string | null {
  // @ts-ignore
  const importStatements: ts.ImportDeclaration[] = sourceFile.statements.filter(
    (stmt) => ts.isImportDeclaration(stmt),
  );

  for (const imp of importStatements) {
    const text = imp.moduleSpecifier.getText(sourceFile).slice(1, -1);

    if (isRelativeGeneratedImport(imp, sourceFile)) {
      // base file and we're importing from it
      // e.g. in create_user_action, we're importing from create_user_action_base
      if (path.basename(file).slice(0, -3) + "_base" !== path.basename(text)) {
        continue;
      }

      const impInfo = getImportInfo(imp, sourceFile);
      if (!impInfo) {
        continue;
      }

      const inputs = impInfo.imports
        .filter((imp) => imp.trim() && imp.endsWith("Input"))
        .map((v) => v.trim());
      if (inputs.length === 1) {
        return inputs[0];
      }
    }
  }
  return null;
}

interface customInfo {
  viewerInfo: {
    path: string;
    name: string;
  };
  relativeImports?: boolean;
}

function getCustomInfo(): customInfo {
  let yaml: Config | undefined = {};

  let relativeImports = false;
  try {
    yaml = load(
      fs.readFileSync(path.join(process.cwd(), "ent.yml"), {
        encoding: "utf8",
      }),
    ) as Config;

    relativeImports = yaml?.codegen?.relativeImports || false;

    if (yaml?.codegen?.templatizedViewer) {
      return {
        viewerInfo: yaml.codegen.templatizedViewer,
        relativeImports,
      };
    }
  } catch (e) {}
  return {
    viewerInfo: {
      path: "@snowtop/ent",
      name: "Viewer",
    },
    relativeImports,
  };
}

async function main() {
  let files = glob.sync("src/ent/**/actions/**/*_action.ts");
  const target = getTargetFromCurrentDir();
  const customInfo = getCustomInfo();
  const viewerInfo = customInfo.viewerInfo;

  files.forEach((file) => {
    let { contents, sourceFile } = createSourceFile(target, file);

    let traversed = false;
    let nodes: NodeInfo[] = [];

    // require action
    const p = require(path.join(process.cwd(), "./" + file.slice(0, -3)));
    const action: Action<any, any> = new p.default(new LoggedOutViewer(), {});

    const builder = action.builder.constructor.name;
    const nodeName = action.builder.ent.name;
    const existingEnt =
      action.builder.operation === WriteOperation.Insert
        ? `${nodeName} | null`
        : nodeName;
    const viewer = viewerInfo.name;

    const input = findInput(file, sourceFile);
    if (!input) {
      return;
    }

    let newImports: string[] = [];
    ts.forEachChild(sourceFile, function (node: ts.Node) {
      if (!ts.isClassDeclaration(node) || !node.heritageClauses) {
        nodes.push({ node });
        return;
      }

      let classInfo = getClassInfo(contents, sourceFile, node);
      // only do classes
      if (!classInfo || !classInfo.default) {
        return;
      }

      let klassContents = "";

      for (const mm of node.members) {
        const conv = getConversionInfo(mm);
        if (conv !== null) {
          const property = mm as ts.PropertyDeclaration;
          // if invalid, bounce
          if (!property.initializer) {
            traversed = false;
            return;
          }

          traversed = true;

          const pp = property.initializer.getFullText(sourceFile).trim();
          const code = `${conv.method}(): ${conv.interface}<${nodeName}, ${builder}<${input}, ${existingEnt}>, ${viewer}, ${input}, ${existingEnt}>[] {
            return ${pp}
          }`;
          newImports.push(conv.interface);
          klassContents += getPreText(contents, mm, sourceFile) + code;
        } else {
          klassContents += mm.getFullText(sourceFile);
        }
      }

      // wrap comments and transform to export class Foo extends Bar { ${inner} }
      nodes.push({ rawString: classInfo.wrapClassContents(klassContents) });
    });

    // if traversed, overwrite.
    if (!traversed) {
      return;
    }

    let newContents = "";
    let afterProcessed = false;

    let imports: Map<string, string[]> = new Map([
      [
        transformRelative(file, viewerInfo.path, customInfo.relativeImports),
        [viewer],
      ],
      [
        transformRelative(file, "src/ent", customInfo.relativeImports),
        [nodeName],
      ],
      ["@snowtop/ent/action", newImports],
    ]);
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

      fs.writeFileSync(file, newContents);
    }
  });

  execSync("prettier src/ent/**/actions/**/*.ts --write");
}

let m = {
  triggers: {
    m: "getTriggers",
    i: "Trigger",
  },
  observers: {
    m: "getObservers",
    i: "Observer",
  },
  validators: {
    m: "getValidators",
    i: "Validator",
  },
};

interface convertReturnInfo {
  text: string;
  method: string;
  interface: string;
}

function getConversionInfo(mm: ts.ClassElement): convertReturnInfo | null {
  if (mm.kind !== ts.SyntaxKind.PropertyDeclaration) {
    return null;
  }
  const text = (mm.name as ts.Identifier).escapedText as string;
  const v = m[text];
  if (v === undefined) {
    return null;
  }
  return {
    text,
    method: v.m,
    interface: v.i,
  };
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
