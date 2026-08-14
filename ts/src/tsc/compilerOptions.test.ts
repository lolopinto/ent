import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import ts from "typescript";
import {
  readCompilerOptions,
  readProjectModuleFormat,
  validateProjectModuleContract,
} from "./compilerOptions.js";

const temporaryDirectories: string[] = [];

function writeProject(options: {
  moduleFormat?: "esm" | "commonjs";
  module?: string;
  moduleResolution?: string;
  packageType?: "module" | "commonjs";
}): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ent-module-"));
  temporaryDirectories.push(directory);
  fs.writeFileSync(
    path.join(directory, "ent.yml"),
    `moduleFormat: ${options.moduleFormat ?? "esm"}\n`,
  );
  fs.writeFileSync(
    path.join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: options.module,
        moduleResolution: options.moduleResolution,
      },
    }),
  );
  fs.writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({
      name: "module-contract-test",
      ...(options.packageType ? { type: options.packageType } : {}),
    }),
  );
  return directory;
}

function writeNestedProject(options: {
  moduleFormat: "esm" | "commonjs";
  module: string;
  moduleResolution: string;
  parentPackageType: "module" | "commonjs";
  childPackage?: boolean;
}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ent-module-workspace-"));
  temporaryDirectories.push(root);
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "module-contract-workspace",
      type: options.parentPackageType,
    }),
  );
  const directory = path.join(root, "app");
  fs.mkdirSync(directory);
  fs.writeFileSync(
    path.join(directory, "ent.yml"),
    `moduleFormat: ${options.moduleFormat}\n`,
  );
  fs.writeFileSync(
    path.join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: options.module,
        moduleResolution: options.moduleResolution,
      },
    }),
  );
  if (options.childPackage) {
    fs.writeFileSync(
      path.join(directory, "package.json"),
      JSON.stringify({ name: "module-contract-app" }),
    );
  }
  return directory;
}

afterEach(() => {
  delete process.env.ENT_MODULE_FORMAT;
  while (temporaryDirectories.length) {
    fs.rmSync(temporaryDirectories.pop()!, {
      recursive: true,
      force: true,
    });
  }
});

test("accepts an explicit CommonJS project contract", () => {
  const directory = writeProject({
    moduleFormat: "commonjs",
    module: "commonjs",
    moduleResolution: "node",
  });
  const options = readCompilerOptions(directory);

  expect(validateProjectModuleContract(directory, options)).toBe("commonjs");
});

test("rejects CommonJS codegen with non-CommonJS TypeScript emit", () => {
  const directory = writeProject({
    moduleFormat: "commonjs",
    moduleResolution: "node",
  });
  const options = readCompilerOptions(directory);

  expect(() => validateProjectModuleContract(directory, options)).toThrow(
    'moduleFormat: commonjs requires compilerOptions.module: "commonjs"',
  );
});

test("rejects CommonJS emit inside a module package", () => {
  const directory = writeProject({
    moduleFormat: "commonjs",
    module: "commonjs",
    moduleResolution: "node",
    packageType: "module",
  });
  const options = readCompilerOptions(directory);

  expect(() => validateProjectModuleContract(directory, options)).toThrow(
    'requires package.json to omit "type" or set "type": "commonjs"',
  );
});

test("accepts a native NodeNext ESM project contract", () => {
  const directory = writeProject({
    moduleFormat: "esm",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    packageType: "module",
  });
  const options = readCompilerOptions(directory);

  expect(options.module).toBe(ts.ModuleKind.NodeNext);
  expect(validateProjectModuleContract(directory, options)).toBe("esm");
});

test("uses the nearest ancestor package type for an ESM workspace project", () => {
  const directory = writeNestedProject({
    moduleFormat: "esm",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    parentPackageType: "module",
  });

  expect(
    validateProjectModuleContract(directory, readCompilerOptions(directory)),
  ).toBe("esm");
});

test("rejects CommonJS output inside an ancestor module package", () => {
  const directory = writeNestedProject({
    moduleFormat: "commonjs",
    module: "commonjs",
    moduleResolution: "node",
    parentPackageType: "module",
  });

  expect(() =>
    validateProjectModuleContract(directory, readCompilerOptions(directory)),
  ).toThrow('requires package.json to omit "type" or set "type": "commonjs"');
});

test("a nearer package without type stops ancestor package lookup", () => {
  const directory = writeNestedProject({
    moduleFormat: "commonjs",
    module: "commonjs",
    moduleResolution: "node",
    parentPackageType: "module",
    childPackage: true,
  });

  expect(
    validateProjectModuleContract(directory, readCompilerOptions(directory)),
  ).toBe("commonjs");
});

test("accepts versioned Node ESM compiler modes", () => {
  for (const module of ["Node16", "Node18", "Node20"]) {
    const directory = writeProject({
      moduleFormat: "esm",
      module,
      moduleResolution: "Node16",
      packageType: "module",
    });
    const options = readCompilerOptions(directory);

    expect(validateProjectModuleContract(directory, options)).toBe("esm");
  }
});

test("rejects ESM codegen without Node ESM compiler settings", () => {
  const directory = writeProject({
    moduleFormat: "esm",
    module: "ESNext",
    moduleResolution: "node",
    packageType: "module",
  });
  const options = readCompilerOptions(directory);

  expect(() => validateProjectModuleContract(directory, options)).toThrow(
    "requires Node16, Node18, or Node20",
  );
});

test("ENT_MODULE_FORMAT overrides ent.yml and is validated", () => {
  const directory = writeProject({
    moduleFormat: "esm",
    module: "commonjs",
    moduleResolution: "node",
  });
  const options = readCompilerOptions(directory);

  process.env.ENT_MODULE_FORMAT = "commonjs";
  expect(readProjectModuleFormat(directory)).toBe("commonjs");
  expect(validateProjectModuleContract(directory, options)).toBe("commonjs");

  process.env.ENT_MODULE_FORMAT = "umd";
  expect(() => readProjectModuleFormat(directory)).toThrow(
    'valid values are "esm" and "commonjs"',
  );
});

test("validates ent.yml before applying ENT_MODULE_FORMAT", () => {
  const directory = writeProject({
    moduleFormat: "esm",
    module: "commonjs",
    moduleResolution: "node",
  });
  fs.writeFileSync(path.join(directory, "ent.yml"), "moduleFormat: amd\n");
  process.env.ENT_MODULE_FORMAT = "commonjs";

  expect(() => readProjectModuleFormat(directory)).toThrow(
    'invalid module format "amd"',
  );
});

test("treats a null moduleFormat like Go's default ESM value", () => {
  const directory = writeProject({
    moduleFormat: "esm",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    packageType: "module",
  });
  fs.writeFileSync(path.join(directory, "ent.yml"), "moduleFormat:\n");

  expect(readProjectModuleFormat(directory)).toBe("esm");
});

test("returns empty compiler options when no ancestor has a tsconfig", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ent-no-tsconfig-"));
  temporaryDirectories.push(directory);

  expect(readCompilerOptions(directory)).toEqual({});
});
