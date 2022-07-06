import ts from "typescript";
import {
  ClassInfo,
  getClassInfo,
  getImportInfo,
  getPreText,
  isRelativeGeneratedImport,
  isSrcGeneratedImport,
  transformRelative,
  customInfo,
} from "../tsc/ast";
import { Action } from "../action";
import { LoggedOutViewer } from "../core/viewer";
import * as path from "path";
import { Data } from "../core/base";
import { TransformFile } from "./transform";
import { snakeCase } from "snake-case";

interface baseFileInfo {
  input: string;
  importPath: string;
}

// returns input and importPath
function getBaseFileInfo(
  file: string,
  classInfo: ClassInfo,
  sourceFile: ts.SourceFile,
): baseFileInfo | null {
  // @ts-ignore
  const importStatements: ts.ImportDeclaration[] = sourceFile.statements.filter(
    (stmt) => ts.isImportDeclaration(stmt),
  );

  for (const imp of importStatements) {
    const text = imp.moduleSpecifier.getText(sourceFile).slice(1, -1);

    if (
      isSrcGeneratedImport(imp, sourceFile) ||
      isRelativeGeneratedImport(imp, sourceFile)
    ) {
      // base file and we're importing from it
      // e.g. in create_user_action, we're importing from create_user_action_base
      if (path.basename(file).slice(0, -3) + "_base" !== path.basename(text)) {
        continue;
      }

      const impInfo = getImportInfo(imp, sourceFile);
      if (!impInfo) {
        continue;
      }

      let inputs = impInfo.imports
        .filter((imp) => imp.trim() && imp.endsWith("Input"))
        .map((v) => v.trim());
      if (inputs.length === 1) {
        return {
          input: inputs[0],
          importPath: impInfo.importPath,
        };
      }
      if (inputs.length && classInfo.name.endsWith("Action")) {
        const prefix = classInfo.name.slice(0, classInfo.name.length - 6);
        inputs = inputs.filter(
          (imp) => imp.slice(0, imp.length - 5) === prefix,
        );
        if (inputs.length === 1) {
          return {
            input: inputs[0],
            importPath: impInfo.importPath,
          };
        }
      }
    }
  }
  return null;
}

interface convertReturnInfo {
  text: string;
  method: string;
  interface: string;
  methodType: string;
}

let m: Data = {
  triggers: {
    m: "getTriggers",
    i: "Trigger",
    suffix: "Triggers",
  },
  observers: {
    m: "getObservers",
    i: "Observer",
    suffix: "Observers",
  },
  validators: {
    m: "getValidators",
    i: "Validator",
    suffix: "Validators",
  },
};

function getConversionInfo(
  mm: ts.ClassElement,
  actionName: string,
): convertReturnInfo | null {
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
    // CreateFooActionTriggers etc
    methodType: actionName + v.suffix,
  };
}

export class TransformAction implements TransformFile {
  glob = "src/ent/**/actions/**/*_action.ts";

  prettierGlob = "src/ent/**/actions/**.ts";

  constructor(private customInfo: customInfo) {}

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
    // only do classes
    if (!classInfo || !classInfo.default) {
      return;
    }

    // require action
    const p = require(path.join(process.cwd(), "./" + file.slice(0, -3)));
    const action: Action<any, any> = new p.default(new LoggedOutViewer(), {});
    const actionName = action.constructor.name;

    const builder = action.builder.constructor.name;
    const nodeName = action.builder.ent.name;
    const viewer = this.customInfo.viewerInfo.name;

    const baseInfo = getBaseFileInfo(file, classInfo, sourceFile);
    if (!baseInfo) {
      return;
    }

    let klassContents = "";

    let traversed = false;
    let newImports: string[] = [];
    for (const mm of node.members) {
      const conv = getConversionInfo(mm, actionName);
      if (conv !== null) {
        const property = mm as ts.PropertyDeclaration;
        // if invalid, bounce
        if (!property.initializer) {
          return;
        }

        traversed = true;

        const pp = property.initializer.getFullText(sourceFile).trim();
        const code = `${conv.method}(): ${conv.methodType} {
            return ${pp}
          }`;
        newImports.push(conv.methodType);
        klassContents += getPreText(contents, mm, sourceFile) + code;
      } else {
        klassContents += mm.getFullText(sourceFile);
      }
    }

    const builderPath = `src/ent/generated/${snakeCase(
      nodeName,
    )}/actions/${snakeCase(builder)}`;

    let imports: Map<string, string[]> = new Map([
      [
        transformRelative(
          file,
          this.customInfo.viewerInfo.path,
          this.customInfo.relativeImports,
        ),
        [viewer],
      ],
      [
        transformRelative(
          file,
          baseInfo.importPath,
          this.customInfo.relativeImports,
        ),
        newImports,
      ],
      [
        transformRelative(file, builderPath, this.customInfo.relativeImports),
        [builder],
      ],
    ]);

    // wrap comments and transform to export class Foo extends Bar { ${inner} }
    return {
      rawString: classInfo.wrapClassContents(klassContents),
      traversed,
      imports,
    };
  }
}
