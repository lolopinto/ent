import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";
import JSON5 from "json5";

function createCompilerHost(
  options: ts.CompilerOptions,
  moduleSearchLocations: string[],
): ts.CompilerHost {
  return {
    getSourceFile,
    getDefaultLibFileName: () => "lib.d.ts",
    writeFile: (fileName, content) => ts.sys.writeFile(fileName, content),
    getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
    getDirectories: (path) => ts.sys.getDirectories(path),
    getCanonicalFileName: (fileName) =>
      ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    getNewLine: () => ts.sys.newLine,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    fileExists,
    readFile,
    resolveModuleNames,
  };

  function fileExists(fileName: string): boolean {
    return ts.sys.fileExists(fileName);
  }

  function readFile(fileName: string): string | undefined {
    return ts.sys.readFile(fileName);
  }

  function getSourceFile(
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
  function resolveModuleNames(
    moduleNames: string[],
    containingFile: string,
  ): ts.ResolvedModule[] {
    //console.log(moduleNames);
    const resolvedModules: ts.ResolvedModule[] = [];
    // console.log("resolve called");
    // console.log(moduleNames, containingFile);
    let cwd = process.cwd();
    for (const moduleName of moduleNames) {
      // try to use standard resolution
      let result = ts.resolveModuleName(moduleName, containingFile, options, {
        fileExists,
        readFile,
      });
      // console.log("standard", result);
      if (result.resolvedModule) {
        resolvedModules.push(result.resolvedModule);
      } else {
        // here's where we do the math and tell it where to go
        // let's be simple for now...
        // check fallback locations, for simplicity assume that module at location
        // should be represented by '.d.ts' file
        // for (const location of moduleSearchLocations) {
        //   const modulePath = path.join(location, moduleName + ".d.ts");
        //   if (fileExists(modulePath)) {
        //     resolvedModules.push({ resolvedFileName: modulePath });
        //   }
        // }
        // hack!!!
        // TODO generalize these and figure out path mechanics
        if (/^src\//.test(moduleName)) {
          //          console.log("src", moduleName);
          resolvedModules.push({
            resolvedFileName: cwd + moduleName + ".ts",
          });
          // TODO go from here...
        } else if (/^ent\//.test(moduleName)) {
          //          console.log("ent", moduleName);
          resolvedModules.push({
            resolvedFileName: cwd + "../../src/" + moduleName.substr(3) + ".ts",
          });
        } else {
          // flip it and do these first...
          //          console.log("orphaned", moduleName);
          for (const location of moduleSearchLocations) {
            const modulePath = path.join(location, moduleName + ".d.ts");
            if (fileExists(modulePath)) {
              //              console.log("found", moduleName);
              resolvedModules.push({ resolvedFileName: modulePath });
            }
          }
        }
      }
    }
    return resolvedModules;
  }
}

function readCompilerOptions(): ts.CompilerOptions {
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

function transformer(context: ts.TransformationContext) {
  //      const resolver = context.getEmitResolver();
  //  const compilerOptions = context.getCompilerOptions();

  //  console.log(context);

  let cwd = process.cwd();
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
    //    console.log("full path", fullPath);
    // console.log(process.cwd);
    // //    console.log()
    // console.log(path.isAbsolute(node.fileName));
    // console.log("filename", node.fileName, node.moduleName);

    function visitor(node: ts.Node) {
      if (/^import/.test(node.getText())) {
        // console.log(node.getText());
        // console.log(node.kind);
        //        console.log(node.)
        //        console.log(node);
      }
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
          console.log("yay ent");
          //          relPath = "./../../" + path.relative(path.dirname(fullPath), text);
          // TODO need to do this transformation automatically
          relPath = path.relative(
            path.dirname(fullPath),
            "../../src" + text.substr(3),
          );

          console.log(fullPath, text, relPath);
        }
        //        console.log(importNode.moduleSpecifier.getText());

        if (relPath !== undefined) {
          console.log("update!");
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
    //    console.log(node.isDeclarationFile);
    //    return node;
  };
}

function compile(sourceFiles: string[], moduleSearchLocations: string[]): void {
  const options = readCompilerOptions();
  //  console.log(options);
  // TODO read tsconfig.json for this?
  // const options: ts.CompilerOptions = {
  //   module: ts.ModuleKind.CommonJS,
  //   target: ts.ScriptTarget.ES2015,
  //   noEmitOnError: true,
  //   noImplicitAny: true,
  // };
  const host = createCompilerHost(options, moduleSearchLocations);
  const program = ts.createProgram(sourceFiles, options, host);
  /// do something with program...
  //console.log(program.getSourceFiles());
  // TODO look at customTransformers???
  let emitResult = program.emit(undefined, undefined, undefined, undefined, {
    before: [transformer],
  });
  console.log(emitResult);

  let exitCode = emitResult.emitSkipped ? 1 : 0;
  console.log(`Process exiting with code '${exitCode}'.`);
  process.exit(exitCode);
}

// TODO need to figure out how to do evetything here...?
compile(["src/index.ts"], ["node_modules/@types/node"]);
