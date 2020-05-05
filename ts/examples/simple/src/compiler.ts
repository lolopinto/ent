import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";
import JSON5 from "json5";

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
        fileExists: this.fileExists,
        readFile: this.readFile,
      },
    );
    return result.resolvedModule;
  }

  private resolvePaths(moduleName: string, _containingFile: string) {
    //      console.log("resolvePaths", moduleName);
    if (!this.options.paths) {
      return null;
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
    return null;
  }

  private otherLocations(moduleName: string, containingFile: string) {
    for (const location of this.moduleSearchLocations) {
      const modulePath = path.join(location, moduleName + ".d.ts");
      if (this.fileExists(modulePath)) {
        return { resolvedFileName: modulePath };
      }
    }
    return null;
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
      fileExists: this.fileExists,
      readFile: this.readFile,
      resolveModuleNames: (moduleNames: string[], containingFile: string) => {
        return this.resolveModuleNames(moduleNames, containingFile);
      },
    };
  }

  private fileExists(fileName: string): boolean {
    return ts.sys.fileExists(fileName);
  }

  private readFile(fileName: string): string | undefined {
    return ts.sys.readFile(fileName);
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
  ): ts.ResolvedModule[] {
    // go through each moduleName and resolvers in order to see if we find what we're looking for
    let resolvedModules: ts.ResolvedModule[] = [];
    for (const moduleName of moduleNames) {
      for (const resolver of this.resolvers) {
        let result = resolver(moduleName, containingFile);
        // yay!
        if (result) {
          resolvedModules.push(result);
          break;
        }
      }
    }

    if (moduleNames.length !== resolvedModules.length) {
      // TODO if not equal, we need to do more
      // it doesn't seem to be coming here for node_modules here which is good
      console.error(
        "couldn't resolve everything",
        moduleNames,
        resolvedModules,
      );
    }
    return resolvedModules;
  }

  private transformer(context: ts.TransformationContext) {
    let cwd = this.cwd;
    return function(node: ts.SourceFile) {
      // don't do anything with declaration files
      // nothing to do here
      if (node.isDeclarationFile) {
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

      function visitor(node: ts.Node) {
        if (node.kind === ts.SyntaxKind.ImportDeclaration) {
          let importNode = node as ts.ImportDeclaration;
          //        console.log(importNode.importClause);
          // TODO now we're cooking with gas
          // and need to change this to figure out how to update the visited node...

          //        importNode.moduleSpecifier.g
          let text = importNode.moduleSpecifier.getText();
          //        console.log(fullPath, text);
          // remove quotes
          text = text.slice(1, -1);

          let relPath: string | undefined;
          // it's relative. include
          if (/^src/.test(text)) {
            //          console.log("yay src");
            // usually we'd want transformations first based on regex...
            // just because of how imports work. it's relative from directory not current path
            relPath = "./" + path.relative(path.dirname(fullPath), text);

            //          console.log(fullPath, text, relPath);

            // quote it...
            //          relPath = '"' + relPath + '"';
            //          text =
          }

          if (/^ent/.test(text)) {
            //          console.log("yay ent");
            //          relPath = "./../../" + path.relative(path.dirname(fullPath), text);
            // TODO need to do this transformation automatically
            relPath = path.relative(
              path.dirname(fullPath),
              "../../src" + text.substr(3),
            );

            //console.log(fullPath, text, relPath);
          }
          //        console.log(importNode.moduleSpecifier.getText());

          if (relPath !== undefined) {
            //          console.log("update!");
            //          console.log(ts.createLiteral(relPath));
            // update the node...
            return ts.updateImportDeclaration(
              importNode,
              importNode.decorators,
              importNode.modifiers,
              importNode.importClause,
              //          importNode.moduleSpecifier,
              // damn did everything and still doesn't work....
              ts.createLiteral(relPath),
            );
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

// TODO need to figure out how to do evetything here...?
new Compiler(["src/index.ts"], ["node_modules/@types/node"]).compile();
