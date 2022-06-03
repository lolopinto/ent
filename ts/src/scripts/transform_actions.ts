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

interface processImportInfo {
  input?: string;
  viewerImported?: boolean;
}

interface imports {
  path: string;
  import: string;
}

function processImports(
  file: string,
  sourceFile: ts.SourceFile,
  viewerPath: string,
  viewer: string,
): processImportInfo {
  // @ts-ignore
  const importStatements: ts.ImportDeclaration[] = sourceFile.statements.filter(
    (stmt) => ts.isImportDeclaration(stmt),
  );
  let input: string | undefined;
  let viewerImported = false;

  //  console.debug(importStatements);
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
        input = inputs[0];
      }
    } else if (!viewerImported && text === viewerPath) {
      // should work for both relative and absolute imports
      const impInfo = getImportInfo(imp, sourceFile);
      if (!impInfo) {
        continue;
      }
      const inputs = impInfo.imports.filter((imp) => imp.trim() === viewer);
      viewerImported = inputs.length === 1;
    }
  }

  return {
    viewerImported,
    input,
  };
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
    if (!file.endsWith("create_auth_code_action.ts")) {
      return;
    }
    //    console.debug(file);
    let { contents, sourceFile } = createSourceFile(target, file);

    let traversed = false;
    let nodes: NodeInfo[] = [];

    // require action
    const p = require(path.join(process.cwd(), "./" + file.slice(0, -3)));
    const action: Action<any, any> = new p.default(new LoggedOutViewer(), {});
    // const options: OrchestratorOptions<any, any, any> =
    //   action.builder.orchestrator.options;

    const builder = action.builder.constructor.name;
    const nodeName = action.builder.ent.name;
    const existingEnt =
      action.builder.operation === WriteOperation.Insert
        ? `${nodeName} | null`
        : nodeName;
    const viewer = customInfo.viewerInfo.name;
    // input is all that's left...
    // need to read ent.yml for custom viewer

    let viewerPath = viewerInfo.path;

    // find relative path and convert to relative import if needed
    if (customInfo.relativeImports && viewerInfo.path.startsWith("src")) {
      const fileFullPath = path.join(process.cwd(), file);
      const viewerFullPath = path.join(process.cwd(), viewerInfo.path);
      // relative path is from directory
      viewerPath = path.relative(path.dirname(fileFullPath), viewerFullPath);
    }

    const importsInfo = processImports(file, sourceFile, viewerPath, viewer);
    if (!importsInfo?.input) {
      return;
    }
    const input = importsInfo.input;
    // TODO User, AuthCode etc

    let missingImports: imports[] = [];
    // add viewer to list of missing imports
    if (!importsInfo.viewerImported) {
      missingImports.push({
        path: viewerPath,
        import: viewer,
      });
    }

    let newImports: string[] = [];
    ts.forEachChild(sourceFile, function (node: ts.Node) {
      if (!ts.isClassDeclaration(node) || !node.heritageClauses) {
        nodes.push({ node });
        return;
      }

      let classInfo = getClassInfo(contents, sourceFile, node);
      // only do classes
      if (!classInfo) {
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

          const pp = property.initializer.getFullText(sourceFile);
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

    const processAfterImport = () => {
      // do this for the first non-import node we see
      // we want to add it last and there's an assumption that imports are ordered.
      if (!afterProcessed && missingImports.length) {
        for (const imp of missingImports) {
          newContents += `\nimport { ${imp.import} } from "${imp.path}"`;
        }
        afterProcessed = true;
      }
    };

    for (const node of nodes) {
      if (node.node) {
        if (ts.isImportDeclaration(node.node)) {
          console.debug(newImports);
          let transformed = transformImport(contents, node.node, sourceFile, {
            newImports,
            transformPath: "@snowtop/ent/action",
          });
          console.debug(transformed);
          if (transformed) {
            newContents += transformed;
            continue;
          }
        } else {
          processAfterImport();
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
