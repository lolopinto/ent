import * as fs from "fs";
import ts from "typescript";
import * as path from "path";
import { load } from "js-yaml";

function findTSConfigFile(filePath: string): string | null {
  filePath = path.resolve(filePath);
  while (true) {
    const configPath = path.join(filePath, "tsconfig.json");
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    const parent = path.dirname(filePath);
    if (parent === filePath) {
      return null;
    }
    filePath = parent;
  }
}

function getProjectRoot(filePath: string): string {
  const configPath = findTSConfigFile(filePath);
  if (!configPath) {
    return path.resolve(filePath);
  }
  return path.dirname(configPath);
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

export type ProjectModuleFormat = "esm" | "commonjs";

function parseModuleFormat(
  value: unknown,
  source: string,
): ProjectModuleFormat {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "esm"
  ) {
    return "esm";
  }
  if (value === "commonjs") {
    return "commonjs";
  }
  throw new Error(
    `invalid module format ${JSON.stringify(value)} from ${source}; valid values are "esm" and "commonjs"`,
  );
}

export function readProjectModuleFormat(filePath: string): ProjectModuleFormat {
  const projectRoot = getProjectRoot(filePath);
  let configuredModuleFormat: ProjectModuleFormat = "esm";
  for (const relativePath of [
    "ent.yml",
    "src/ent.yml",
    "src/graphql/ent.yml",
  ]) {
    const configPath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(configPath)) {
      continue;
    }
    const config = load(fs.readFileSync(configPath, "utf8"));
    if (config === null || typeof config !== "object") {
      throw new Error(`invalid Ent configuration in ${configPath}`);
    }
    configuredModuleFormat = parseModuleFormat(
      (config as { moduleFormat?: unknown }).moduleFormat,
      configPath,
    );
    break;
  }

  if (process.env.ENT_MODULE_FORMAT !== undefined) {
    return parseModuleFormat(
      process.env.ENT_MODULE_FORMAT,
      "ENT_MODULE_FORMAT",
    );
  }
  return configuredModuleFormat;
}

function readPackageType(projectRoot: string): string | undefined {
  let directory = path.resolve(projectRoot);
  while (true) {
    const packagePath = path.join(directory, "package.json");
    if (fs.existsSync(packagePath)) {
      const packageJSON = JSON.parse(fs.readFileSync(packagePath, "utf8")) as {
        type?: unknown;
      };
      return typeof packageJSON.type === "string"
        ? packageJSON.type
        : undefined;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return undefined;
    }
    directory = parent;
  }
}

function moduleKindName(module: ts.ModuleKind | undefined): string {
  return module === undefined ? "<unset>" : ts.ModuleKind[module];
}

function moduleResolutionName(
  resolution: ts.ModuleResolutionKind | undefined,
): string {
  return resolution === undefined
    ? "<unset>"
    : ts.ModuleResolutionKind[resolution];
}

export function validateProjectModuleContract(
  filePath: string,
  options: ts.CompilerOptions,
): ProjectModuleFormat {
  const projectRoot = getProjectRoot(filePath);
  const moduleFormat = readProjectModuleFormat(projectRoot);
  const packageType = readPackageType(projectRoot);

  if (moduleFormat === "commonjs") {
    if (options.module !== ts.ModuleKind.CommonJS) {
      throw new Error(
        `moduleFormat: commonjs requires compilerOptions.module: "commonjs" in tsconfig.json; received ${moduleKindName(options.module)}. Codegen controls generated specifiers, while TypeScript controls emitted JavaScript.`,
      );
    }
    if (packageType === "module") {
      throw new Error(
        'moduleFormat: commonjs requires package.json to omit "type" or set "type": "commonjs"; emitted .js files cannot be CommonJS inside a "type": "module" package.',
      );
    }
    return moduleFormat;
  }

  const versionedNode =
    (options.module === ts.ModuleKind.Node16 ||
      options.module === ts.ModuleKind.Node18 ||
      options.module === ts.ModuleKind.Node20) &&
    options.moduleResolution === ts.ModuleResolutionKind.Node16;
  const nodeNext =
    options.module === ts.ModuleKind.NodeNext &&
    options.moduleResolution === ts.ModuleResolutionKind.NodeNext;
  if (!versionedNode && !nodeNext) {
    throw new Error(
      `moduleFormat: esm requires Node16, Node18, or Node20 module with Node16 moduleResolution, or matching NodeNext values; received module ${moduleKindName(options.module)} and moduleResolution ${moduleResolutionName(options.moduleResolution)}.`,
    );
  }
  if (packageType !== "module") {
    throw new Error(
      'moduleFormat: esm requires package.json "type": "module" so Node treats emitted .js files as ESM.',
    );
  }
  return moduleFormat;
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
