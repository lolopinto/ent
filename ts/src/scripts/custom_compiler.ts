#!/usr/bin/env node

import ts from "typescript";
import * as path from "path";
import * as fs from "fs";
import JSON5 from "json5";
import glob from "glob";

// TODO this should probably be its own package but for now it's here

class Compiler {
  private options: ts.CompilerOptions;
  private regexMap: Map<string, RegExp> = new Map();
  private cwd: string;

  private resolvers: ((
    moduleName: string,
    containingFile: string,
  ) => ts.ResolvedModule | undefined | null)[] = [];

  constructor(
    private sourceFiles: string[],
    private moduleSearchLocations: string[],
  ) {
    this.options = this.readCompilerOptions();
    if (this.options.paths) {
      for (let key in this.options.paths) {
        if (key === "*") {
          continue;
        }
        // always make sure it starts at the beginning...
        this.regexMap.set(key, new RegExp("^" + key, "i"));
      }
    }
    // TODO should be taking baseUrl and using that instead of using cwd and assuming baseUrl == "."
    this.cwd = process.cwd();

    // set resolvers
    this.resolvers = [
      // standard
      this.standardModules.bind(this),

      // resolvePaths based on tsconfig's paths
      this.resolvePaths.bind(this),

      // use node or other location paths
      this.otherLocations.bind(this),
    ];
  }

  private standardModules(moduleName: string, containingFile: string) {
    let result = ts.resolveModuleName(
      moduleName,
      containingFile,
      this.options,
      {
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
      },
    );
    return result.resolvedModule;
  }

  private resolvePaths(
    moduleName: string,
    _containingFile: string,
  ): ts.ResolvedModule | undefined {
    //      console.log("resolvePaths", moduleName);
    if (!this.options.paths) {
      return undefined;
    }

    let paths = this.options.paths;
    for (let key in paths) {
      let r = this.regexMap.get(key);
      if (!r) {
        continue;
      }
      let value = paths[key];

      if (r.test(moduleName)) {
        // substitute...
        // can this be more than one?
        // not for now...
        let str = value[0];
        let lastIdx = value[0].lastIndexOf("*");
        if (lastIdx === -1) {
          console.error("incorrectly formatted regex");
          continue;
        }
        str = str.substr(0, lastIdx);
        let resolvedFileName =
          path.join(this.cwd, moduleName.replace(r, str)) + ".ts";
        //          console.log(resolvedFileName);
        return {
          resolvedFileName,
        };
      }
    }
    return undefined;
  }

  private otherLocations(moduleName: string, _containingFile: string) {
    for (const location of this.moduleSearchLocations) {
      const modulePath = path.join(location, moduleName + ".d.ts");
      if (ts.sys.fileExists(modulePath)) {
        return { resolvedFileName: modulePath };
      }
    }
    return undefined;
  }

  private readCompilerOptions(): ts.CompilerOptions {
    let json = {};
    try {
      json = JSON5.parse(
        fs.readFileSync("./tsconfig.json", {
          encoding: "utf8",
        }),
      );
    } catch (e) {
      console.error("couldn't read tsconfig.json file");
    }
    let options = json["compilerOptions"] || {};
    if (options.moduleResolution === "node") {
      options.moduleResolution = ts.ModuleResolutionKind.NodeJs;
    }
    return options;
  }

  private createCompilerHost(): ts.CompilerHost {
    return {
      getSourceFile: this.getSourceFile,
      getDefaultLibFileName: () => "lib.d.ts",
      writeFile: (fileName, content) => ts.sys.writeFile(fileName, content),
      getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
      getDirectories: (path) => ts.sys.getDirectories(path),
      getCanonicalFileName: (fileName) =>
        ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
      getNewLine: () => ts.sys.newLine,
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      resolveModuleNames: (
        moduleNames: string[],
        containingFile: string,
        _reusedNames: string[] | undefined,
        _redirectedReference: ts.ResolvedProjectReference | undefined,
        _options: ts.CompilerOptions,
      ) => {
        return this.resolveModuleNames(moduleNames, containingFile);
      },
    };
  }

  private getSourceFile(
    fileName: string,
    languageVersion: ts.ScriptTarget,
    onError?: (message: string) => void,
  ) {
    const sourceText = ts.sys.readFile(fileName);
    return sourceText !== undefined
      ? ts.createSourceFile(fileName, sourceText, languageVersion)
      : undefined;
  }

  // this is not enough because it doesn't solve the outputted file?
  private resolveModuleNames(
    moduleNames: string[],
    containingFile: string,
  ): (ts.ResolvedModule | undefined)[] {
    // go through each moduleName and resolvers in order to see if we find what we're looking for
    let resolvedModules: (ts.ResolvedModule | undefined)[] = [];
    for (const moduleName of moduleNames) {
      // undefined is valid
      let resolved: ts.ResolvedModule | undefined;
      for (const resolver of this.resolvers) {
        let result = resolver(moduleName, containingFile);
        // yay!
        if (result) {
          resolved = result;
          break;
        }
      }
      resolvedModules.push(resolved);
    }

    return resolvedModules;
  }

  private transformer(context: ts.TransformationContext) {
    let cwd = this.cwd;
    let paths = this.options.paths;
    let regexMap = this.regexMap;
    return function (node: ts.SourceFile) {
      // don't do anything with declaration files
      // nothing to do here
      if (node.isDeclarationFile) {
        return node;
      }

      // no paths, nothing to do heree
      if (!paths) {
        return node;
      }

      let fullPath: string;
      if (path.isAbsolute(node.fileName)) {
        fullPath = node.fileName;
      } else {
        fullPath = path.join(cwd, node.fileName);
      }
      // don't care about paths not relative to cwd since we can't handle that...
      let relativePath = path.relative(cwd, fullPath);
      if (relativePath.startsWith("..")) {
        return node;
      }

      function checkPath(
        paths: ts.MapLike<string[]> | undefined,
        text: string,
      ): string | undefined {
        // remove quotes
        text = text.slice(1, -1);
        let relPath: string | undefined;

        for (const key in paths) {
          let r = regexMap.get(key);
          if (!r) {
            continue;
          }
          let value = paths[key];
          let str = value[0];

          if (!r.test(text)) {
            continue;
          }
          let idx = text.indexOf("/");
          let strIdx = str.indexOf("*");
          if (idx === -1 || strIdx === -1) {
            continue;
          }
          relPath = path.relative(
            // just because of how imports work. it's relative from directory not current path
            path.dirname(fullPath),
            path.join(
              text.substr(0, idx).replace(r, str.substr(0, strIdx)),
              text.substr(idx),
            ),
          );
          // if file ends with "..", we've reached a case where we're trying to
          // import something like foo/contact(.ts) from within foo/contact/bar/baz/page.ts
          // and we're confused about it so we need to detect that case and handle it
          if (relPath.endsWith("..")) {
            // there's an actual local file here not root of directory, try that instead
            // (if root of directory and there's ambiguity, we should use "contact/")
            if (ts.sys.fileExists(text + ".ts")) {
              let text2 = text + ".ts";
              relPath = path.relative(
                // just because of how imports work. it's relative from directory not current path
                path.dirname(fullPath),
                path.join(
                  text2.substr(0, idx).replace(r, str.substr(0, strIdx)),
                  text2.substr(idx),
                ),
              );
            }
          }
          if (!relPath.startsWith("..")) {
            relPath = "./" + relPath;
          }

          // tsc removes this by default so we need to also do it
          let tsIdx = relPath.indexOf(".ts");
          if (tsIdx !== -1) {
            relPath = relPath.substr(0, tsIdx);
          }
          return relPath;
        }
      }

      function visitor(node: ts.Node) {
        if (node.kind === ts.SyntaxKind.ImportDeclaration) {
          let importNode = node as ts.ImportDeclaration;

          let text = importNode.moduleSpecifier.getText();
          let relPath = checkPath(paths, text);
          if (relPath) {
            // update the node...
            return ts.updateImportDeclaration(
              importNode,
              importNode.decorators,
              importNode.modifiers,
              importNode.importClause,
              ts.createLiteral(relPath),
            );
          }
        }
        if (node.kind === ts.SyntaxKind.ExportDeclaration) {
          let exportNode = node as ts.ExportDeclaration;

          let text = exportNode.moduleSpecifier?.getText();

          if (text) {
            let relPath = checkPath(paths, text);
            if (relPath) {
              // update the node...
              return ts.updateExportDeclaration(
                exportNode,
                exportNode.decorators,
                exportNode.modifiers,
                exportNode.exportClause,
                ts.createLiteral(relPath),
                exportNode.isTypeOnly,
              );
            }
          }
        }
        return node;
      }

      return ts.visitEachChild(node, visitor, context);
    };
  }

  compile(): void {
    const host = this.createCompilerHost();
    const program = ts.createProgram(this.sourceFiles, this.options, host);
    let emitResult = program.emit(undefined, undefined, undefined, undefined, {
      before: [this.transformer.bind(this)],
    });
    if (emitResult.emitSkipped) {
      console.error("error emitting code");
    }

    let exitCode = emitResult.emitSkipped ? 1 : 0;
    process.exit(exitCode);
  }
}

// let's use a glob from current directory
// todo this should be configurable
// TODO this should be broken into its own repo and npm module
// TODO use includes and exclude in tsconfig.json if it exists
new Compiler(
  glob.sync("**/*.ts", {
    ignore: ["node_modules/**", "tests/**", "**/*.test.ts"],
  }),
  ["node_modules/@types/node"],
).compile();
