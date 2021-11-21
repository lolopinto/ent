import glob from "glob";
import ts from "typescript";
import JSON5 from "json5";
import * as fs from "fs";
import * as path from "path";
import { Data } from "../core/base";

function getFiles(filePath: string, opts?: Options): string[] {
  if (!path.isAbsolute(filePath)) {
    throw new Error("absolute file path required");
  }
  // graphql path should be passed to this
  // this is more agnostic about what it expect here
  let files = glob.sync(`${filePath}/**/*.ts`, {
    ignore: opts?.ignore,
  });
  if (opts?.filter) {
    files = files.filter(opts.filter);
  }
  return files;
}

export interface Options {
  filter?: (file: string, index: number, array: string[]) => boolean;
  ignore?: string | Readonly<string[]> | undefined;
}

export interface PathResult {
  m: Map<string, file[]>;
  // throws if there's more than one class that maps to this
  getInfoForClass(className: string): classResult;
}

interface classResult {
  class: classInfo;
  file: file;
}

export function parseCustomImports(
  filePath: string,
  opts?: Options,
): PathResult {
  const files = getFiles(filePath, opts);
  const options = readCompilerOptions(filePath);

  let classMap = new Map<string, file[]>();

  files.forEach((file) => {
    const sourceFile = ts.createSourceFile(
      file,
      fs.readFileSync(file).toString(),
      options.target || ts.ScriptTarget.ES2015,
    );

    let f: file = {
      path: sourceFile.fileName,
      imports: new Map(),
      classes: new Map(),
    };
    traverse(sourceFile, f, classMap);
    //console.log(f);
    //    console.log(classMap);
  });

  return {
    m: classMap,
    getInfoForClass: (className: string) => {
      let files = classMap.get(className);
      if (files?.length !== 1) {
        throw new Error(
          `expected 1 class with name ${className}, got ${
            files?.length || 0
          } classes instead`,
        );
      }
      let f = files[0];
      let info = f.classes.get(className);
      if (!info) {
        throw new Error(
          `expected to find info for class ${className} in file ${f.path}`,
        );
      }
      return {
        class: info,
        file: f,
      };
    },
  };
}

export function findTSConfigFile(filePath: string): string | null {
  while (filePath != "/") {
    let configPath = `${filePath}/tsconfig.json`;
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    filePath = path.join(filePath, "..");
  }
  return null;
}

// inspiration taken from compiler.ts
function readCompilerOptions(filePath: string): ts.CompilerOptions {
  let configPath = findTSConfigFile(filePath);
  if (!configPath) {
    return {};
  }
  let json: Data = {};
  try {
    json = JSON5.parse(
      fs.readFileSync(configPath, {
        encoding: "utf8",
      }),
    );
  } catch (e) {
    console.error("couldn't read tsconfig.json file");
    return {};
  }
  let options = json["compilerOptions"] || {};
  if (options.moduleResolution === "node") {
    options.moduleResolution = ts.ModuleResolutionKind.NodeJs;
  }
  return options;
}

export interface importInfo {
  name: string; // name in the file
  importPath: string; // where it's imported from
  defaultImport?: boolean; // default import?
}

export interface classInfo {
  name: string;
  exported: boolean;
  defaultExport: boolean;
}

export interface file {
  path: string; // path to file
  imports: Map<string, importInfo>; // imported things, mapping from name to importInfo
  classes: Map<string, classInfo>; // classInfo
}

function traverse(
  sourceFile: ts.SourceFile,
  f: file,
  classMap: Map<string, file[]>,
) {
  ts.forEachChild(sourceFile, function (node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration:
        let importNode = node as ts.ImportDeclaration;
        let text = importNode.moduleSpecifier.getText(sourceFile);
        // remove quotes
        text = text.slice(1, -1);

        let imported = importNode.importClause?.namedBindings;
        if (imported) {
          if (imported?.kind === ts.SyntaxKind.NamedImports) {
            imported.elements.forEach((el) => {
              f.imports.set(el.name.text, {
                name: el.name.text,
                importPath: text,
              });
            });
          } else {
            // TODO
            //            console.log("ttt?", sourceFile.fileName, text, imported.name);
          }
        } else {
          let name = importNode.importClause?.name?.text;
          if (name) {
            f.imports.set(name, {
              name,
              importPath: text,
              defaultImport: true,
            });
          }
        }

        break;
      case ts.SyntaxKind.ClassDeclaration:
        let classNode = node as ts.ClassDeclaration;
        //        console.log(classNode);
        let exported = false;
        let defaultExport = false;
        if (classNode.modifiers?.length) {
          classNode.modifiers.forEach((modifier) => {
            if (modifier.kind === ts.SyntaxKind.ExportKeyword) {
              exported = true;
            }
            if (modifier.kind === ts.SyntaxKind.DefaultKeyword) {
              defaultExport = true;
            }
          });
        }
        let name = classNode.name?.text;
        if (name) {
          f.classes.set(name, {
            name,
            exported,
            defaultExport,
          });
          if (classMap.has(name)) {
            let files = classMap.get(name)!;
            files.push(f);
          } else {
            let files = [f];
            classMap.set(name, files);
          }
        }
        // TODO functions and other things from files incase needed to disambiguate duplicate classes
        //        console.log(classNode.name?.text, exported, defaultExport);
        // classNode.members.forEach((member) => {
        //   member.decorators?.forEach((decorator) => {
        //     console.log(decorator.expression.getText(sourceFile));
        //   });
        //   console.log(
        //     classNode.name?.text,
        //     member.name?.getText(sourceFile),
        //     member.decorators?.length,
        //   );
        // });

        //        console.log(classNode.modifiers);
        //        console.log(classNode);
        //        classNode.members.map((member) => console.log(member));
        break;
    }
  });
}
