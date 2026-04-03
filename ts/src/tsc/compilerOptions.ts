import * as fs from "fs";
import ts from "typescript";
import * as path from "path";

function findTSConfigFile(filePath: string): string | null {
  while (filePath != "/") {
    let configPath = `${filePath}/tsconfig.json`;
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    filePath = path.join(filePath, "..");
  }
  return null;
}

export function readCompilerOptions(filePath: string) {
  const configPath = findTSConfigFile(filePath);
  if (!configPath) {
    return {};
  }

  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  if (error) {
    console.error("couldn't read tsconfig.json file");
    return {};
  }

  return ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  ).options;
}

export function getTarget(target?: string | number): ts.ScriptTarget {
  if (typeof target === "number") {
    return target;
  }
  switch (target?.toLowerCase()) {
    case "es2015":
      return ts.ScriptTarget.ES2015;
    case "es2016":
      return ts.ScriptTarget.ES2016;
    case "es2017":
      return ts.ScriptTarget.ES2017;
    case "es2018":
      return ts.ScriptTarget.ES2018;
    case "es2019":
      return ts.ScriptTarget.ES2019;
    case "es2020":
      return ts.ScriptTarget.ES2020;
    case "es2021":
      return ts.ScriptTarget.ES2021;
    case "es3":
      return ts.ScriptTarget.ES3;
    case "es5":
      return ts.ScriptTarget.ES5;
    case "esnext":
      return ts.ScriptTarget.ESNext;
    default:
      return ts.ScriptTarget.ESNext;
  }
}

export function getModule(module?: string | number): ts.ModuleKind {
  if (typeof module === "number") {
    return module;
  }
  switch (module?.toLowerCase()) {
    case "none":
      return ts.ModuleKind.None;
    case "commonjs":
      return ts.ModuleKind.CommonJS;
    case "amd":
      return ts.ModuleKind.AMD;
    case "umd":
      return ts.ModuleKind.UMD;
    case "system":
      return ts.ModuleKind.System;
    case "es2015":
      return ts.ModuleKind.ES2015;
    case "es2020":
      return ts.ModuleKind.ES2020;
    case "es2022":
      return ts.ModuleKind.ES2022;
    case "esnext":
      return ts.ModuleKind.ESNext;
    case "node16":
      return ts.ModuleKind.Node16;
    case "nodenext":
      return ts.ModuleKind.NodeNext;
    default:
      return ts.ModuleKind.CommonJS;
  }
}

export function getTargetFromCurrentDir(): ts.ScriptTarget {
  const options = readCompilerOptions(".");
  return getTarget(options.target);
}

export function createSourceFile(target: ts.ScriptTarget, file: string) {
  let contents = fs.readFileSync(file).toString();

  // go through the file and print everything back if not starting immediately after other position
  const sourceFile = ts.createSourceFile(
    file,
    contents,
    target,
    false,
    ts.ScriptKind.TS,
  );
  return { contents, sourceFile };
}
