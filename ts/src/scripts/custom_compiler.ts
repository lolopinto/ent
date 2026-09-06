#!/usr/bin/env node

import ts from "typescript";
import * as path from "path";
import * as glob from "glob";
import { createRequire } from "module";
import { readCompilerOptions } from "../tsc/compilerOptions";

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
    this.options = readCompilerOptions(".");
    if (this.options.paths) {
      for (let key in this.options.paths) {
        // Match the whole, case-sensitive TS path pattern, including the slash
        // in aliases such as src/*; packages like src-extra must stay intact.
        const pattern = key
          .split("*")
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("(.*)");
        this.regexMap.set(key, new RegExp("^" + pattern + "$"));
      }
    }
    this.cwd = process.cwd();

    // set resolvers
    this.resolvers = [
      // standard
      this.standardModules.bind(this),

      // use node or other location paths
      this.otherLocations.bind(this),
    ];
  }

  private standardModules(
    moduleName: string,
    containingFile: string,
    options = this.options,
  ) {
    const host: ts.ModuleResolutionHost = {
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      getCurrentDirectory: () => this.cwd,
    };
    let result = ts.resolveModuleName(
      moduleName,
      containingFile,
      options,
      host,
    );
    if (!result.resolvedModule && options.paths) {
      const key = this.matchPathPattern(moduleName);
      if (key && moduleName.match(this.regexMap.get(key)!)?.[1] === "") {
        // TS leaves the substitution's star intact for an empty capture.
        // Retain this compiler's existing empty-alias behavior only after
        // ordinary TS resolution fails, and use it for both emit and the host.
        result = ts.resolveModuleName(
          moduleName,
          containingFile,
          {
            ...options,
            paths: {
              [moduleName]: options.paths[key].map((value) =>
                value.replace("*", ""),
              ),
            },
          },
          host,
        );
      }
    }
    return result.resolvedModule;
  }

  private matchPathPattern(moduleName: string) {
    const paths = this.options.paths;
    if (!paths) {
      return undefined;
    }
    // TypeScript selects an exact key first, then the matching wildcard with
    // the longest prefix. It does not fall back to less-specific patterns.
    let key =
      Object.prototype.hasOwnProperty.call(paths, moduleName) &&
      !moduleName.includes("*")
        ? moduleName
        : undefined;
    if (key === undefined) {
      let prefixLength = -1;
      for (const [pattern, regex] of this.regexMap) {
        const prefix = pattern.indexOf("*");
        if (prefix > prefixLength && regex.test(moduleName)) {
          key = pattern;
          prefixLength = prefix;
        }
      }
    }
    return key;
  }

  private resolvePathMapping(moduleName: string, containingFile: string) {
    const paths = this.options.paths;
    const key = this.matchPathPattern(moduleName);
    // Keep the historical catch-all behavior: it is not an emitted alias.
    if (!paths || key === undefined || key === "*") return undefined;
    const resolvedModule = this.standardModules(moduleName, containingFile);
    if (!resolvedModule) return undefined;
    const canonical = (file: string) => {
      const absolute = path.resolve(this.cwd, file);
      return ts.sys.useCaseSensitiveFileNames
        ? absolute
        : absolute.toLowerCase();
    };
    const resolvedPath = canonical(resolvedModule.resolvedFileName);
    const wildcard = moduleName.match(this.regexMap.get(key)!)?.[1];
    const pathsBase = this.options.baseUrl ?? this.options.pathsBasePath;
    const baseDirectory = path.resolve(
      this.cwd,
      typeof pathsBase === "string" ? pathsBase : ".",
    );

    for (const substitution of paths[key]) {
      const expanded =
        wildcard !== undefined
          ? substitution.replace("*", () => wildcard)
          : substitution;
      // A trailing slash requires directory resolution even when a sibling
      // file with the same basename exists.
      const targetPath =
        path.resolve(baseDirectory, expanded) +
        (/[\\/]$/.test(expanded) ? path.sep : "");
      // Resolve each candidate as an absolute module so a missing candidate
      // cannot silently fall through to the original package or its @types.
      // Compare against the full resolution: TS may choose a later typed file
      // before an earlier JS candidate. An explicit paths filename is loaded
      // directly by TS before extension substitution, so retain that match too.
      const candidate = this.standardModules(targetPath, containingFile, {
        ...this.options,
        paths: undefined,
      });
      if (
        (canonical(targetPath) === resolvedPath &&
          ts.sys.fileExists(targetPath)) ||
        (candidate && canonical(candidate.resolvedFileName) === resolvedPath)
      ) {
        return { targetPath, resolvedModule };
      }
    }
    // Normal package/baseUrl lookup won after the selected pattern failed.
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

  private resolveRuntimeModule(targetPath: string, containingFile: string) {
    // Ask TS to apply moduleSuffixes to runtime files, independently of companion
    // declarations. Directory lookups still use package main rather than assuming
    // that a declaration's neighboring JavaScript is the package entry point.
    const resolved = ts.resolveModuleName(
      targetPath,
      containingFile,
      { ...this.options, paths: undefined },
      {
        fileExists: (file) =>
          !/\.(ts|tsx|mts|cts)$/.test(file) && ts.sys.fileExists(file),
        readFile: ts.sys.readFile,
        getCurrentDirectory: () => this.cwd,
      },
    ).resolvedModule?.resolvedFileName;
    return resolved && /\.(js|jsx|mjs|cjs|json)$/.test(resolved)
      ? path.resolve(this.cwd, resolved)
      : undefined;
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

  private transformer(program: ts.Program, context: ts.TransformationContext) {
    let cwd = this.cwd;
    let paths = this.options.paths;
    const resolveMapping = this.resolvePathMapping.bind(this);
    const resolveRuntime = this.resolveRuntimeModule.bind(this);
    const moduleSuffixes = this.options.moduleSuffixes;
    const declarationFilePattern = /\.d\.(ts|mts|cts)$/;
    const commonJS = this.options.module === ts.ModuleKind.CommonJS;
    const emitConfig: ts.ParsedCommandLine = {
      options: {
        ...this.options,
        configFilePath: path.resolve(
          cwd,
          typeof this.options.configFilePath === "string"
            ? this.options.configFilePath
            : "tsconfig.json",
        ),
      },
      fileNames: program
        .getSourceFiles()
        .filter(
          (file) =>
            !file.isDeclarationFile &&
            !program.isSourceFileFromExternalLibrary(file),
        )
        .map((file) =>
          path.resolve(cwd, file.fileName).split(path.sep).join("/"),
        ),
      errors: [],
    };
    const emittedFiles = new Set(
      emitConfig.fileNames.map((file) => path.resolve(file)),
    );
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
      let outputPath: string | undefined;
      function getOutputPath() {
        return (outputPath ??= path.resolve(
          cwd,
          ts.getOutputFileNames(
            emitConfig,
            fullPath,
            !ts.sys.useCaseSensitiveFileNames,
          )[0],
        ));
      }
      let outputRequire: NodeJS.Require | undefined;
      function getOutputRequire() {
        return (outputRequire ??= createRequire(getOutputPath()));
      }

      function usesPackageInstallation(
        packageName: string,
        mappedRoot: string,
        specifier: string,
      ) {
        if (commonJS) {
          // Node can skip an existing package directory that lacks the requested
          // entry. Compare actual resolution from both lookup locations, including
          // exports, subpaths, and symlinks whose destination is outside the package.
          try {
            const mappedSearchRoot = path.resolve(
              mappedRoot,
              ...packageName.split("/").map(() => ".."),
            );
            const mappedRequire = createRequire(
              path.join(mappedSearchRoot, "__ent_resolve__.js"),
            );
            return (
              getOutputRequire().resolve(specifier) ===
              mappedRequire.resolve(specifier)
            );
          } catch {
            return false;
          }
        }
        const outputDirectory = path.dirname(getOutputPath());
        const scopeFile = ts.findConfigFile(
          outputDirectory,
          ts.sys.fileExists,
          "package.json",
        );
        const scope =
          scopeFile && JSON.parse(ts.sys.readFile(scopeFile) ?? "{}");
        // Native ESM package self-references precede node_modules lookup. Inspect
        // its package search directories without applying CommonJS export conditions.
        const installedRoot =
          scopeFile && scope.name === packageName && scope.exports != null
            ? path.dirname(scopeFile)
            : getOutputRequire()
                .resolve.paths(packageName)
                ?.filter((directory) => {
                  // Native ESM does not search NODE_PATH or global module directories.
                  const relative = path.relative(
                    path.dirname(directory),
                    outputDirectory,
                  );
                  return (
                    path.basename(directory) === "node_modules" &&
                    relative !== ".." &&
                    !relative.startsWith(".." + path.sep) &&
                    !path.isAbsolute(relative)
                  );
                })
                .map((directory) => path.join(directory, packageName))
                .find((directory) => ts.sys.directoryExists(directory));
        return (
          installedRoot !== undefined &&
          (ts.sys.realpath?.(installedRoot) ?? installedRoot) ===
            (ts.sys.realpath?.(mappedRoot) ?? mappedRoot)
        );
      }

      function checkPath(text: string): string | undefined {
        const mapping = resolveMapping(text, fullPath);
        if (!mapping) return undefined;
        const { targetPath, resolvedModule } = mapping;
        const resolvedPath = resolvedModule.resolvedFileName;
        // Declaration mappings supply types, not runtime modules. Preserve
        // the original specifier so Node can still load the actual package.
        if (declarationFilePattern.test(targetPath)) {
          return undefined;
        }
        // Installed dependencies stay outside outDir. Preserve Node's package
        // lookup only when the mapping keeps the specifier and installation unchanged;
        // dep/value -> dep/lib/value is an explicit remap that must still apply.
        // Check the mapped runtime path because TS may find declarations in a
        // separate @types package instead of alongside the JavaScript.
        const packagePath = text.split("/").join(path.sep);
        if (
          targetPath.endsWith(
            `${path.sep}node_modules${path.sep}${packagePath}`,
          )
        ) {
          const packageName = text
            .split("/")
            .slice(0, text.startsWith("@") ? 2 : 1)
            .join("/");
          const mappedRoot = path.join(
            targetPath.slice(0, -packagePath.length),
            packageName,
          );
          if (usesPackageInstallation(packageName, mappedRoot, text)) {
            return undefined;
          }
        }
        let runtimePath: string | undefined;
        try {
          runtimePath = require.resolve(targetPath);
        } catch {
          // TypeScript source aliases need not have JavaScript on disk yet.
        }
        if (/\.(js|jsx|mjs|cjs|json)$/.test(resolvedPath)) {
          // Module suffixes and directory metadata can select a different
          // runtime file from Node's resolution of the configured path.
          runtimePath = path.resolve(cwd, resolvedPath);
        }
        if (resolvedPath && declarationFilePattern.test(resolvedPath)) {
          if (moduleSuffixes?.length) {
            runtimePath = resolveRuntime(targetPath, fullPath) ?? runtimePath;
          }
          // Extensionless paths can resolve to dep.d.ts or dep/index.d.ts.
          // A JavaScript module may also have companion declarations, so
          // retain rewriting when the mapped target has a runtime module.
          if (!runtimePath || declarationFilePattern.test(runtimePath)) {
            return undefined;
          }
        }
        // TypeScript extension substitution wins over stale JavaScript beside
        // a source file: that import must continue to use the freshly emitted code.
        const sourcePath =
          resolvedPath && !declarationFilePattern.test(resolvedPath)
            ? path.resolve(cwd, resolvedPath)
            : runtimePath;
        if (
          runtimePath &&
          sourcePath &&
          (!emittedFiles.has(sourcePath) ||
            sourcePath.split(path.sep).includes("node_modules"))
        ) {
          // This runtime module is not copied with the application's sources.
          // Use the emitted importer's directory, including inferred rootDir.
          const outputDirectory = path.dirname(getOutputPath());
          if (commonJS) {
            // require.resolve uses CommonJS export conditions; an ESM import
            // of the same package may intentionally select another entry.
            try {
              if (getOutputRequire().resolve(text) === runtimePath) {
                return undefined;
              }
            } catch {
              // A renamed dependency may have no corresponding bare package.
            }
          }
          // Use the actual runtime filename so native ESM receives an extension
          // and directory mappings reach their package entry point.
          const externalPath = path
            .relative(outputDirectory, runtimePath)
            .split(path.sep)
            .join("/");
          return externalPath.startsWith("../")
            ? externalPath
            : "./" + externalPath;
        }
        if (!sourcePath || !emittedFiles.has(sourcePath)) return undefined;
        // Use the source TypeScript selected, not the configured directory or
        // basename. Its emitted filename reflects package entries, moduleSuffixes,
        // and JSX mode even when package.json is not copied into outDir.
        const emittedPath = ts.getOutputFileNames(
          emitConfig,
          sourcePath,
          !ts.sys.useCaseSensitiveFileNames,
        )[0];
        let relPath = path
          .relative(
            path.dirname(getOutputPath()),
            path.resolve(cwd, emittedPath),
          )
          .split(path.sep)
          .join("/");
        // Preserve the existing extensionless convention for TS/CommonJS aliases.
        // Runtime extensions in the original specifier or target, and JSX/MJS/CJS
        // outputs, keep their emitted extension even if substitution removes it.
        if (
          relPath.endsWith(".js") &&
          !/\.(js|jsx|mjs|cjs)$/.test(text) &&
          !/\.(js|jsx|mjs|cjs|tsx|mts|cts)$/.test(targetPath)
        ) {
          relPath = relPath.slice(0, -3);
        }
        return relPath.startsWith("../") ? relPath : "./" + relPath;
      }

      function visitor(node: ts.Node): ts.VisitResult<ts.Node> {
        if (node.kind === ts.SyntaxKind.ImportDeclaration) {
          let importNode = node as ts.ImportDeclaration;

          let text = (importNode.moduleSpecifier as ts.StringLiteral).text;
          let relPath = checkPath(text);
          if (relPath) {
            // update the node...
            return ts.factory.updateImportDeclaration(
              importNode,
              importNode.modifiers,
              importNode.importClause,
              ts.factory.createStringLiteral(relPath),
              importNode.assertClause,
            );
          }
        }
        if (node.kind === ts.SyntaxKind.ExportDeclaration) {
          let exportNode = node as ts.ExportDeclaration;

          let text = (
            exportNode.moduleSpecifier as ts.StringLiteral | undefined
          )?.text;

          if (text) {
            let relPath = checkPath(text);
            if (relPath) {
              // update the node...
              return ts.factory.updateExportDeclaration(
                exportNode,
                exportNode.modifiers,
                exportNode.isTypeOnly,
                exportNode.exportClause,
                ts.factory.createStringLiteral(relPath),
                exportNode.assertClause,
              );
            }
          }
        }
        // Dynamic imports are CallExpressions and may be nested in methods,
        // callbacks, or another import's options. Visit children before updating
        // the specifier so those expressions retain their normal behavior.
        node = ts.visitEachChild(node, visitor, context);
        if (
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments.length > 0 &&
          ts.isStringLiteralLike(node.arguments[0])
        ) {
          const relPath = checkPath(node.arguments[0].text);
          if (relPath) {
            return ts.factory.updateCallExpression(
              node,
              node.expression,
              node.typeArguments,
              [
                ts.factory.createStringLiteral(relPath),
                ...node.arguments.slice(1),
              ],
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
      before: [(context) => this.transformer(program, context)],
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
