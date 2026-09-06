import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import ts from "typescript";

let testRoot: string;
let compiler: string;

function write(root: string, name: string, contents: string) {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

beforeAll(() => {
  testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ent-custom-compiler-"));
  const toolRoot = path.join(testRoot, "tool");
  // Compile the CLI under test independently of dist so stale builds cannot pass.
  for (const name of ["scripts/custom_compiler", "tsc/compilerOptions"]) {
    const source = fs.readFileSync(
      path.join(__dirname, "..", `${name}.ts`),
      "utf8",
    );
    write(
      toolRoot,
      `${name}.js`,
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
      }).outputText,
    );
  }
  fs.symlinkSync(
    path.resolve(__dirname, "../../node_modules"),
    path.join(toolRoot, "node_modules"),
    "dir",
  );
  compiler = path.join(toolRoot, "scripts/custom_compiler.js");
});

afterAll(() => {
  if (testRoot) {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
});

function fixture(
  files: Record<string, string>,
  options: Record<string, unknown> = {},
  esm = false,
) {
  const root = fs.mkdtempSync(path.join(testRoot, "app-"));
  write(
    root,
    "package.json",
    JSON.stringify({ type: esm ? "module" : "commonjs" }),
  );
  write(
    root,
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        module: esm ? "esnext" : "commonjs",
        moduleResolution: "node",
        target: "es2020",
        rootDir: "src",
        outDir: "dist",
        baseUrl: ".",
        paths: { "src/*": ["./src/*"], "*": ["*"] },
        esModuleInterop: true,
        skipLibCheck: true,
        ...options,
      },
      include: ["src/**/*.ts"],
    }),
  );
  for (const [name, contents] of Object.entries(files)) {
    write(root, name, contents);
  }
  return root;
}

function compile(root: string) {
  return spawnSync(process.execPath, [compiler], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });
}

function run(root: string, entry = "dist/main.js") {
  const compiled = compile(root);
  expect({
    status: compiled.status,
    stderr: compiled.stderr,
    error: compiled.error,
  }).toEqual({ status: 0, stderr: "", error: undefined });
  const result = spawnSync(process.execPath, [entry], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });
  expect({
    status: result.status,
    stderr: result.stderr,
    error: result.error,
  }).toEqual({ status: 0, stderr: "", error: undefined });
  return result.stdout.trim();
}

test("compiled CommonJS defers privacy/model aliases until the policy runs", () => {
  const root = fixture({
    "src/main.ts": `
      import { Policy } from "src/privacy/policy";
      import { events } from "src/state";
      async function main() {
        if (events.length) throw new Error("model loaded before privacy check");
        const contact = await new Policy().apply();
        console.log(JSON.stringify([contact.name, events]));
      }
      main().catch(error => { console.error(error); process.exitCode = 1; });
    `,
    "src/state.ts": `export const events: string[] = [];`,
    "src/privacy/policy.ts": `
      import type { Contact } from "src/ent";
      export class Policy {
        async apply(): Promise<Contact> {
          const { Contact } = await import("src/ent");
          return new Contact();
        }
      }
    `,
    "src/ent/index.ts": `
      import { events } from "src/state";
      events.push("model");
      export class Contact { name = "Ada"; }
    `,
  });
  expect(run(root)).toBe('["Ada",["model"]]');
});

test.each([
  {
    jsx: "react",
    esm: false,
    target: "./src/*.tsx",
    specifier: "views/component",
  },
  {
    jsx: "react",
    esm: true,
    target: "./src/*.tsx",
    specifier: "views/component",
  },
  {
    jsx: "react",
    esm: false,
    target: "./src/*",
    specifier: "views/component.tsx",
  },
  {
    jsx: "preserve",
    esm: false,
    target: "./src/*.tsx",
    specifier: "views/component",
  },
])("uses the emitted TSX extension for $specifier (jsx: $jsx, ESM: $esm)", ({
  jsx,
  esm,
  target,
  specifier,
}) => {
  const root = fixture(
    {
      "src/main.ts": `
        import { value } from "${specifier}";
        import { exported } from "./exports.js";
        import("${specifier}").then(mod => console.log([value, exported, mod.value].join(",")));
      `,
      "src/exports.ts": `export { value as exported } from "${specifier}";`,
      "src/component.tsx": `export const value = "tsx";`,
    },
    { jsx, paths: { "views/*": [target] } },
    esm,
  );
  expect(run(root)).toBe("tsx,tsx,tsx");
});

test("compiled CommonJS rewrites literal aliases and preserves other module expressions", () => {
  const root = fixture({
    "src/main.ts": `
      import assert from "node:assert/strict";
      import { exported } from "src/exports";
      async function main() {
        const relative = "./foo";
        const loader = { load: () => import("src/foo") };
        assert.equal((await loader.load()).value, "foo");
        assert.equal((await import(\`src/foo\`)).value, "foo");
        assert.equal((await import("src/\\u0066oo")).value, "foo");
        assert.equal((await import("src/foo.js")).value, "foo");
        assert.equal((await import("./foo")).value, "foo");
        assert.equal((await import(relative)).value, "foo");
        assert.equal((await import(\`\${relative}\`)).value, "foo");
        assert.equal((await import("node:path")).basename("a/b"), "b");
        assert.equal((await import("src-extra/value")).value, "package");
        assert.equal((await import("src.ts-package/value")).value, "package");
        assert.equal((await import("src/.ts-cache/value")).value, "directory");
        assert.equal(await (await import("src/contact/bar/loader")).load(), "file");
        assert.equal(exported, "foo");
        console.log("ok");
      }
      main().catch(error => { console.error(error); process.exitCode = 1; });
    `,
    "src/foo.ts": `export const value = "foo";`,
    "src/exports.ts": `export { value as exported } from "src/foo"; export type { Type } from "src/types";`,
    "src/types.ts": `throw new Error("type-only module loaded"); export interface Type { value: string }`,
    "src/.ts-cache/value.ts": `export const value = "directory";`,
    "src/contact.ts": `export const value = "file";`,
    "src/contact/bar/loader.ts": `export async function load() { return (await import("src/contact")).value; }`,
    "node_modules/src-extra/value.js": `exports.value = "package";`,
    "node_modules/src.ts-package/value.js": `exports.value = "package";`,
  });
  expect(run(root)).toBe("ok");
});

test("ESNext output preserves explicit JS extensions and dynamic import options in Node ESM", () => {
  const root = fixture(
    {
      "src/main.ts": `
      import assert from "node:assert/strict";
      import { exported } from "src/exports.js";
      import type { Type } from "src/types.js";
      const load = () => import("src/foo.js");
      assert.equal((await load()).value, exported);
      assert.equal((await import("./foo.js")).value, "foo");
      assert.equal((await import("node:path")).basename("a/b"), "b");
      assert.equal((await import("src/data.json", { with: { type: "json" } })).default.value, "json");
      assert.equal((await import("src/data.json", (await import("src/options.js")).options)).default.value, "json");
      console.log("ok");
    `,
      "src/foo.ts": `export const value = "foo";`,
      "src/exports.ts": `export { value as exported } from "src/foo.js"; export type { Type } from "src/types.js";`,
      "src/types.ts": `throw new Error("type-only module loaded"); export interface Type { value: string }`,
      "src/options.ts": `export const options = { with: { type: "json" } };`,
      "src/data.json": `{"value":"json"}`,
    },
    { resolveJsonModule: true },
    true,
  );
  expect(run(root)).toBe("ok");
});

test.each([
  { outDir: undefined, absolute: false },
  { outDir: "src", absolute: false },
  { outDir: "src", absolute: true },
])("loads in-place JSON aliases with outDir $outDir (absolute: $absolute)", ({
  outDir,
  absolute,
}) => {
  const root = fixture(
    {
      "src/main.ts": `
      import { value } from "src/data.json";
      import { exported } from "./exports";
      import("src/data.json").then(mod => console.log([value, exported, mod.value].join(",")));
    `,
      "src/exports.ts": 'export { value as exported } from "src/data.json";',
      "src/data.json": '{"value":"json"}',
    },
    { outDir, resolveJsonModule: true },
  );
  if (absolute) {
    const config = JSON.parse(
      fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
    );
    config.compilerOptions.outDir = path.join(root, "src");
    write(root, "tsconfig.json", JSON.stringify(config));
  }
  expect(run(root, "src/main.js")).toBe("json,json,json");
});

test.each([
  { pattern: "vendor/*.js", target: "./src/*", specifier: "vendor/value.js" },
  {
    pattern: "alias/value.js",
    target: "./src/value.ts",
    specifier: "alias/value.js",
  },
])("preserves an explicit ESM extension when $pattern maps to $target", ({
  pattern,
  target,
  specifier,
}) => {
  const root = fixture(
    {
      "src/main.ts": `
      import { value } from "${specifier}";
      import { exported } from "./exports.js";
      const dynamic = await import("${specifier}");
      console.log([value, exported, dynamic.value].join(","));
    `,
      "src/exports.ts": `export { value as exported } from "${specifier}";`,
      "src/value.ts": 'export const value = "mapped";',
    },
    { paths: { [pattern]: [target] } },
    true,
  );
  expect(run(root)).toBe("mapped,mapped,mapped");
});

test("does not rewrite imports without configured paths", () => {
  const root = fixture(
    {
      "src/main.ts": `import("./foo").then(mod => console.log(mod.value));`,
      "src/foo.ts": `export const value = "relative";`,
    },
    { paths: undefined },
  );
  expect(run(root)).toBe("relative");
});

test.each([
  {
    target: "./types/dep.d.ts",
    declaration: "types/dep.d.ts",
    pattern: "dep",
    specifier: "dep",
    esm: false,
  },
  {
    target: "./types/dep.d.mts",
    declaration: "types/dep.d.mts",
    pattern: "dep",
    specifier: "dep",
    esm: true,
  },
  {
    target: "./types/*.d.cts",
    declaration: "types/value.d.cts",
    pattern: "dep/*",
    specifier: "dep/value",
    esm: false,
  },
  {
    target: "./types/dep",
    declaration: "types/dep.d.ts",
    pattern: "dep",
    specifier: "dep",
    esm: false,
  },
  {
    target: "./types/dep",
    declaration: "types/dep/index.d.ts",
    pattern: "dep",
    specifier: "dep",
    esm: false,
  },
])("preserves package imports when $target resolves to $declaration", ({
  target,
  declaration,
  pattern,
  specifier,
  esm,
}) => {
  const root = fixture(
    {
      "src/main.ts": `
          import assert from "node:assert/strict";
          import { value } from "${specifier}";
          import { exported } from "./exports.js";
          async function main() {
            assert.equal(value, "package");
            assert.equal(exported, "package");
            assert.equal((await import("${specifier}")).value, "package");
            console.log("ok");
          }
          main().catch(error => { console.error(error); process.exitCode = 1; });
        `,
      "src/exports.ts": `export { value as exported } from "${specifier}";`,
      [declaration]: `export declare const value: string;`,
      "node_modules/dep/package.json": JSON.stringify({
        type: esm ? "module" : "commonjs",
        exports: { ".": "./index.js", "./value": "./index.js" },
      }),
      "node_modules/dep/index.js": esm
        ? `export const value = "package";`
        : `exports.value = "package";`,
    },
    {
      paths: { [pattern]: [target] },
    },
    esm,
  );
  expect(run(root)).toBe("ok");
});

test.each([
  { packageName: "dep", subpath: "", declarations: "bundled", esm: false },
  { packageName: "dep", subpath: "", declarations: "none", esm: false },
  { packageName: "dep", subpath: "", declarations: "separate", esm: false },
  {
    packageName: "@scope/dep",
    subpath: "/value",
    declarations: "bundled",
    esm: true,
  },
  {
    packageName: "@scope/dep",
    subpath: "/value",
    declarations: "separate",
    esm: true,
  },
])("preserves node_modules mappings for $packageName$subpath (declarations: $declarations, ESM: $esm)", ({
  packageName,
  subpath,
  declarations,
  esm,
}) => {
  const specifier = packageName + subpath;
  const pattern = packageName + (subpath ? "/*" : "");
  const packageRoot = `node_modules/${packageName}`;
  const declarationRoot =
    declarations === "separate"
      ? `node_modules/@types/${packageName.replace(/^@/, "").replace("/", "__")}`
      : packageRoot;
  const root = fixture(
    {
      "src/main.ts": `
        import assert from "node:assert/strict";
        import { value } from "${specifier}";
        import { exported } from "./exports.js";
        async function main() {
          assert.equal(value, "package");
          assert.equal(exported, "package");
          assert.equal((await import("${specifier}")).value, "package");
          console.log("ok");
        }
        main().catch(error => { console.error(error); process.exitCode = 1; });
      `,
      "src/exports.ts": `export { value as exported } from "${specifier}";`,
      [`${packageRoot}/package.json`]: JSON.stringify({
        type: esm ? "module" : "commonjs",
        main: "index.js",
        ...(declarations === "bundled" ? { types: "index.d.ts" } : {}),
        exports: { ".": "./index.js", "./value": "./index.js" },
      }),
      [`${packageRoot}/index.js`]: esm
        ? `export const value = "package";`
        : `exports.value = "package";`,
      // Preserve package exports instead of loading the paths target directly.
      [`${packageRoot}/value.js`]: esm
        ? `export const value = "mapped-file";`
        : `exports.value = "mapped-file";`,
      ...(declarations !== "none"
        ? {
            [`${declarationRoot}/index.d.ts`]: `export declare const value: string;`,
            [`${declarationRoot}/value.d.ts`]: `export declare const value: string;`,
          }
        : {}),
    },
    { rootDir: ".", paths: { [pattern]: [`./node_modules/${pattern}`] } },
    esm,
  );
  expect(run(root, "dist/src/main.js")).toBe("ok");
});

test.each([
  { packageName: "dep", esm: false },
  { packageName: "dep", esm: true },
  { packageName: "@scope/dep", esm: false },
  { packageName: "@scope/dep", esm: true },
])("preserves package exports with a trailing slash on $packageName (ESM: $esm)", ({
  packageName,
  esm,
}) => {
  const packageRoot = `node_modules/${packageName}`;
  const root = fixture(
    {
      "src/main.ts": `
      import { value } from "${packageName}";
      import { exported } from "./exports.js";
      import("${packageName}").then(mod => console.log([value, exported, mod.value].join(",")));
    `,
      "src/exports.ts": `export { value as exported } from "${packageName}";`,
      [`${packageRoot}/package.json`]: JSON.stringify({
        type: esm ? "module" : "commonjs",
        main: "legacy.js",
        exports: {
          import: "./modern.js",
          require: esm ? "./legacy.js" : "./modern.js",
        },
      }),
      [`${packageRoot}/legacy.js`]: esm
        ? 'export const value = "legacy";'
        : 'exports.value = "legacy";',
      [`${packageRoot}/modern.js`]: esm
        ? 'export const value = "modern";'
        : 'exports.value = "modern";',
    },
    { rootDir: ".", paths: { [packageName]: [`./${packageRoot}/`] } },
    esm,
  );
  expect(run(root, "dist/src/main.js")).toBe("modern,modern,modern");
});

test.each([
  { esm: false, outDir: undefined, entry: "src/main.js" },
  { esm: false, outDir: "dist", entry: "dist/main.js" },
  { esm: true, outDir: "dist", entry: "dist/main.js" },
])("loads the mapped nested package installation (ESM: $esm, outDir: $outDir)", ({
  esm,
  outDir,
  entry,
}) => {
  const root = fixture(
    {
      "src/main.ts": `
        import { value } from "dep/value";
        import { exported } from "./exports.js";
        import("dep/value").then(mod => console.log([value, exported, mod.value].join(",")));
      `,
      "src/exports.ts": `export { value as exported } from "dep/value";`,
      "node_modules/dep/package.json": JSON.stringify({
        type: esm ? "module" : "commonjs",
        exports: { "./value": "./value.js" },
      }),
      "node_modules/dep/value.js": esm
        ? `export const value = "top-level";`
        : `exports.value = "top-level";`,
      "node_modules/vendor/node_modules/dep/package.json": JSON.stringify({
        type: esm ? "module" : "commonjs",
      }),
      "node_modules/vendor/node_modules/dep/value.js": esm
        ? `export const value = "mapped";`
        : `exports.value = "mapped";`,
      "node_modules/vendor/node_modules/dep/value.d.ts": `export declare const value: string;`,
    },
    {
      outDir,
      paths: { "dep/*": ["./node_modules/vendor/node_modules/dep/*"] },
    },
    esm,
  );
  expect(run(root, entry)).toBe("mapped,mapped,mapped");
});

test.each([
  { subpath: "", unrelatedEntry: false },
  { subpath: "/value", unrelatedEntry: true },
])("skips a nearer CommonJS package without the requested entry: dep$subpath", ({
  subpath,
  unrelatedEntry,
}) => {
  const specifier = `dep${subpath}`;
  const root = fixture(
    {
      "src/main.ts": `
      import { value } from "${specifier}";
      import { exported } from "./exports";
      import("${specifier}").then(mod => console.log([value, exported, mod.value].join(",")));
    `,
      "src/exports.ts": `export { value as exported } from "${specifier}";`,
      "node_modules/dep/package.json": JSON.stringify({
        main: "legacy.js",
        exports: { ".": "./modern.js", "./value": "./modern.js" },
      }),
      "node_modules/dep/legacy.js": 'exports.value = "legacy";',
      "node_modules/dep/value.js": 'exports.value = "legacy";',
      "node_modules/dep/modern.js": 'exports.value = "modern";',
      ...(unrelatedEntry
        ? { "dist/node_modules/dep/index.js": 'exports.value = "unrelated";' }
        : {}),
    },
    { rootDir: ".", paths: { [specifier]: [`./node_modules/${specifier}`] } },
  );
  fs.mkdirSync(path.join(root, "dist/node_modules/dep"), { recursive: true });
  expect(run(root, "dist/src/main.js")).toBe("modern,modern,modern");
});

test.each([
  undefined,
  "es5",
])("uses the effective CommonJS default with target %s", (target) => {
  const root = fixture(
    {
      "src/main.ts": `
      import { value } from "dep";
      import { exported } from "./exports";
      import("dep").then(mod => console.log([value, exported, mod.value].join(",")));
    `,
      "src/exports.ts": 'export { value as exported } from "dep";',
      "node_modules/dep/package.json": JSON.stringify({
        main: "legacy.js",
        exports: "./modern.js",
      }),
      "node_modules/dep/legacy.js": 'exports.value = "legacy";',
      "node_modules/dep/modern.js": 'exports.value = "modern";',
    },
    { module: undefined, target, paths: { dep: ["./node_modules/dep"] } },
  );
  fs.mkdirSync(path.join(root, "dist/node_modules/dep"), { recursive: true });
  expect(run(root)).toBe("modern,modern,modern");
});

test("preserves CommonJS package exports through a symlink outside its root", () => {
  const root = fixture(
    {
      "src/main.ts": `
      import { value } from "dep";
      import("dep").then(mod => console.log([value, mod.value].join(",")));
    `,
      "node_modules/dep/package.json": JSON.stringify({
        main: "legacy.js",
        exports: "./linked/modern.js",
      }),
      "node_modules/dep/legacy.js": 'exports.value = "legacy";',
      "linked-build/modern.js": 'exports.value = "modern";',
    },
    { paths: { dep: ["./node_modules/dep"] } },
  );
  fs.symlinkSync(
    path.join(root, "linked-build"),
    path.join(root, "node_modules/dep/linked"),
    "dir",
  );
  expect(run(root)).toBe("modern,modern");
});

test("preserves native ESM import conditions for the mapped package installation", () => {
  const root = fixture(
    {
      "src/main.ts": `
        import { value } from "dep/value";
        import { exported } from "./exports.js";
        import("dep/value").then(mod => console.log([value, exported, mod.value].join(",")));
      `,
      "src/exports.ts": `export { value as exported } from "dep/value";`,
      "node_modules/dep/package.json": JSON.stringify({
        type: "module",
        exports: { "./value": { import: "./import.js" } },
      }),
      "node_modules/dep/import.js": `export const value = "import";`,
      "node_modules/dep/value.js": `export const value = "physical";`,
      "node_modules/dep/value.d.ts": `export declare const value: string;`,
    },
    { paths: { "dep/*": ["./node_modules/dep/*"] } },
    true,
  );
  expect(run(root)).toBe("import,import,import");
});

test.each([
  { rootDir: "src", outDir: "dist", entry: "dist/main.js" },
  { rootDir: ".", outDir: "dist", entry: "dist/src/main.js" },
  { rootDir: undefined, outDir: "build/js", entry: "build/js/main.js" },
  { rootDir: "src", outDir: undefined, entry: "src/main.js" },
  {
    rootDir: undefined,
    outDir: "build/js",
    entry: "build/js/src/main.js",
    extraSource: true,
  },
])("rewrites renamed dependencies with rootDir $rootDir and outDir $outDir", ({
  rootDir,
  outDir,
  entry,
  extraSource,
}) => {
  const root = fixture(
    {
      "src/main.ts": `
        import { value } from "vendor/value";
        import { exported } from "./exports";
        import("vendor/value").then(mod => console.log([value, exported, mod.value].join(",")));
      `,
      "src/exports.ts": `export { value as exported } from "vendor/value";`,
      "node_modules/dep/value.js": `exports.value = "package";`,
      "node_modules/dep/value.d.ts": `export declare const value: string;`,
      ...(extraSource ? { "scripts/extra.ts": "export const value = 1;" } : {}),
    },
    { rootDir, outDir, paths: { "vendor/*": ["./node_modules/dep/*"] } },
  );
  expect(run(root, entry)).toBe("package,package,package");
});

test("composite aliases use the configured output directory", () => {
  const root = fixture(
    {
      "src/main.ts": `
      import { value } from "alias/value";
      import { exported } from "./exports";
      import("alias/value").then(mod => console.log([value, exported, mod.value].join(",")));
    `,
      "src/exports.ts": 'export { value as exported } from "alias/value";',
      "node_modules/dep/value.js": 'exports.value = "javascript";',
    },
    {
      composite: true,
      rootDir: undefined,
      paths: { "alias/*": ["./node_modules/dep/*"] },
    },
  );
  expect(run(root, "dist/src/main.js")).toBe(
    "javascript,javascript,javascript",
  );
});

test.each([
  "index",
  "index.js",
  "lib/entry",
])("preserves equivalent package entry mapping to dep/%s", (entry) => {
  const root = fixture(
    {
      "src/main.ts": `
          import { value } from "dep";
          import { exported } from "./exports";
          import("dep").then(mod => console.log([value, exported, mod.value].join(",")));
        `,
      "src/exports.ts": `export { value as exported } from "dep";`,
      "node_modules/dep/package.json": JSON.stringify({
        main: entry.endsWith(".js") ? entry : `${entry}.js`,
      }),
      [`node_modules/dep/${entry.endsWith(".js") ? entry : `${entry}.js`}`]: `exports.value = "package";`,
      "node_modules/@types/dep/index.d.ts": `export declare const value: string;`,
    },
    { rootDir: ".", paths: { dep: [`./node_modules/dep/${entry}`] } },
  );
  expect(run(root, "dist/src/main.js")).toBe("package,package,package");
  expect(
    fs.readFileSync(path.join(root, "dist/src/main.js"), "utf8"),
  ).toContain('require("dep")');
});

test.each([
  {
    specifier: "dep/value",
    pattern: "dep/*",
    target: "./node_modules/dep/lib/*",
    packageName: "dep",
    runtime: "lib/value.js",
    esm: false,
  },
  {
    specifier: "@scope/dep/value.js",
    pattern: "@scope/dep/*",
    target: "./node_modules/@scope/dep/lib/*",
    packageName: "@scope/dep",
    runtime: "lib/value.js",
    esm: true,
  },
  {
    specifier: "dep/value",
    pattern: "dep/value",
    target: "./node_modules/dep/value/impl.js",
    packageName: "dep",
    runtime: "value/impl.js",
    esm: false,
  },
  {
    specifier: "dep/value",
    pattern: "dep/value",
    target: "./node_modules/dep/value/",
    packageName: "dep",
    runtime: "value/index.js",
    esm: false,
  },
  {
    specifier: "dep/value",
    pattern: "dep/value",
    target: "./node_modules/dep/value/",
    packageName: "dep",
    runtime: "value/index.js",
    esm: true,
  },
])("applies explicit package subpath remapping from $specifier to $target", ({
  specifier,
  pattern,
  target,
  packageName,
  runtime,
  esm,
}) => {
  const packageRoot = `node_modules/${packageName}`;
  const root = fixture(
    {
      "src/main.ts": `
        import { value } from "${specifier}";
        import { exported } from "./exports.js";
        import("${specifier}").then(mod => console.log([value, exported, mod.value].join(",")));
      `,
      "src/exports.ts": `export { value as exported } from "${specifier}";`,
      [`${packageRoot}/package.json`]: JSON.stringify({
        type: esm ? "module" : "commonjs",
      }),
      [`${packageRoot}/value.js`]: esm
        ? `export const value = "original";`
        : `exports.value = "original";`,
      [`${packageRoot}/${runtime}`]: esm
        ? `export const value = "mapped";`
        : `exports.value = "mapped";`,
      [`${packageRoot}/${runtime.replace(/\.js$/, ".d.ts")}`]: `export declare const value: string;`,
    },
    { rootDir: ".", paths: { [pattern]: [target] } },
    esm,
  );
  expect(run(root, "dist/src/main.js")).toBe("mapped,mapped,mapped");
});

test.each([
  { module: "esnext", target: "es2020" },
  { module: undefined, target: "es2015" },
  { module: undefined, target: "es2020" },
])("ESM explicit remapping does not substitute the package's import condition (module: $module, target: $target)", ({
  module,
  target,
}) => {
  const root = fixture(
    {
      "src/main.ts": `
        import { value } from "dep";
        import { exported } from "./exports.js";
        import("dep").then(mod => console.log([value, exported, mod.value].join(",")));
      `,
      "src/exports.ts": `export { value as exported } from "dep";`,
      "node_modules/dep/package.json": JSON.stringify({
        type: "module",
        exports: { import: "./import.js", require: "./require.cjs" },
      }),
      "node_modules/dep/import.js": `export const value = "original";`,
      "node_modules/dep/require.cjs": `exports.value = "mapped";`,
      "node_modules/dep/require.d.cts": `export declare const value: string;`,
    },
    {
      module,
      target,
      rootDir: ".",
      paths: { dep: ["./node_modules/dep/require.cjs"] },
    },
    true,
  );
  expect(run(root, "dist/src/main.js")).toBe("mapped,mapped,mapped");
});

test.each([
  false,
  true,
])("resolves JavaScript aliases with allowJs %s after moving the importer", (allowJs) => {
  const root = fixture(
    {
      "src/main.ts": `import { value } from "vendor/value"; console.log(value);`,
      "vendor/value.js": `exports.value = "javascript";`,
    },
    { rootDir: ".", allowJs, paths: { "vendor/*": ["./vendor/*"] } },
  );
  expect(run(root, "dist/src/main.js")).toBe("javascript");
  expect(fs.existsSync(path.join(root, "dist/vendor/value.js"))).toBe(allowJs);
});

test("rewrites aliases to JavaScript modules with companion declarations", () => {
  const root = fixture(
    {
      "src/main.ts": `
        import assert from "node:assert/strict";
        import { value } from "vendor/dep.js";
        import { exported } from "./exports.js";
        async function main() {
          assert.equal(value, "javascript");
          assert.equal(exported, "javascript");
          assert.equal((await import("vendor/dep.js")).value, "javascript");
          assert.equal((await import("vendor/directory")).value, "directory");
          console.log("ok");
        }
        main().catch(error => { console.error(error); process.exitCode = 1; });
      `,
      "src/exports.ts": `export { value as exported } from "vendor/dep.js";`,
      "vendor/dep.js": `exports.value = "javascript";`,
      "vendor/dep.d.ts": `export declare const value: string;`,
      "vendor/directory/index.js": `exports.value = "directory";`,
      "vendor/directory/index.d.ts": `export declare const value: string;`,
    },
    { paths: { "vendor/*": ["./vendor/*"] } },
  );
  expect(run(root)).toBe("ok");
});

test("prefers emitted TypeScript over existing JavaScript beside the source", () => {
  const root = fixture({
    "src/main.ts": `
      import { value } from "src/value.js";
      import("src/value").then(mod => console.log([value, mod.value].join(",")));
    `,
    "src/value.ts": `export const value = "compiled";`,
    "src/value.js": `exports.value = "stale";`,
  });
  expect(run(root)).toBe("compiled,compiled");
});

test.each<{
  name: string;
  paths: Record<string, string[]>;
  files: Record<string, string>;
  expected: string;
  dynamicOnly?: boolean;
  esm?: boolean;
}>([
  {
    name: "absent first fallback in a dynamic import",
    paths: { "dep/*": ["./overrides/*", "./node_modules/dep/*"] },
    files: {},
    expected: "package",
    dynamicOnly: true,
  },
  {
    name: "valid first JavaScript override",
    paths: { "dep/*": ["./overrides/*", "./node_modules/dep/*"] },
    files: { "overrides/value.js": 'exports.value = "override";' },
    expected: "override",
  },
  {
    name: "third fallback after two missing candidates",
    paths: {
      "dep/*": ["./missing/*", "./also-missing/*", "./node_modules/dep/*"],
    },
    files: {},
    expected: "package",
  },
  {
    name: "normal package lookup after all mappings fail",
    paths: { "dep/*": ["./overrides/*"] },
    files: {},
    expected: "package",
  },
  {
    name: "later TypeScript source before an earlier JavaScript candidate",
    paths: { "dep/*": ["./overrides/*", "./src/typed/*"] },
    files: {
      "overrides/value.js": 'exports.value = "wrong-js";',
      "src/typed/value.ts": 'export const value = "typed";',
    },
    expected: "typed",
  },
  {
    name: "later declarations before an earlier JavaScript candidate",
    paths: { "dep/*": ["./overrides/*", "./types/*", "./src/typed/*"] },
    files: {
      "overrides/value.js": 'exports.value = "wrong-js";',
      "types/value.d.ts": "export declare const value: string;",
      "src/typed/value.ts": 'export const value = "wrong-ts";',
    },
    expected: "package",
  },
  {
    name: "explicit declarations before a runtime candidate",
    paths: { "dep/*": ["./types/*.d.ts", "./overrides/*"] },
    files: {
      "types/value.d.ts": "export declare const value: string;",
      "overrides/value.js": 'exports.value = "wrong-js";',
    },
    expected: "package",
  },
  {
    name: "exact pattern before an earlier wildcard",
    paths: {
      "dep/*": ["./overrides/*"],
      "dep/value": ["./node_modules/dep/value"],
    },
    files: { "overrides/value.js": 'exports.value = "wrong-pattern";' },
    expected: "package",
  },
  {
    name: "longest prefix before an earlier wildcard",
    paths: { "dep/*": ["./overrides/*"], "dep/v*": ["./node_modules/dep/v*"] },
    files: { "overrides/value.js": 'exports.value = "wrong-pattern";' },
    expected: "package",
  },
  {
    name: "normal lookup instead of a less-specific pattern",
    paths: { "dep/*": ["./overrides/*"], "dep/value": ["./missing/value"] },
    files: { "overrides/value.js": 'exports.value = "wrong-pattern";' },
    expected: "package",
  },
  {
    name: "native ESM exports after a missing fallback",
    paths: { "dep/*": ["./overrides/*", "./node_modules/dep/*"] },
    files: {},
    expected: "package",
    esm: true,
  },
])("follows TypeScript mapping selection: $name", ({
  paths,
  files,
  expected,
  dynamicOnly,
  esm = false,
}) => {
  const root = fixture(
    {
      "src/main.ts": dynamicOnly
        ? `import("dep/value").then(mod => console.log(mod.value));`
        : `
          import { value } from "dep/value";
          import { exported } from "./exports.js";
          import("dep/value").then(mod => console.log([value, exported, mod.value].join(",")));
        `,
      "src/exports.ts": 'export { value as exported } from "dep/value";',
      "node_modules/dep/package.json": JSON.stringify({
        type: esm ? "module" : "commonjs",
        exports: { "./value": esm ? { import: "./import.js" } : "./value.js" },
      }),
      "node_modules/dep/value.js": esm
        ? 'export const value = "physical";'
        : 'exports.value = "package";',
      "node_modules/dep/import.js": 'export const value = "package";',
      ...files,
    },
    { rootDir: ".", paths },
    esm,
  );
  expect(run(root, "dist/src/main.js")).toBe(
    dynamicOnly ? expected : [expected, expected, expected].join(","),
  );
});

test.each([
  true,
  false,
])("uses the resolved directory entry with an index decoy: %s", (indexDecoy) => {
  const root = fixture({
    "src/main.ts": `
      import { value } from "src/dep";
      import { exported } from "./exports";
      import("src/dep").then(mod => console.log([value, exported, mod.value].join(",")));
    `,
    "src/exports.ts": 'export { value as exported } from "src/dep";',
    "src/dep/package.json": JSON.stringify({ main: "lib/value.js" }),
    "src/dep/lib/value.ts": 'export const value = "selected-main";',
    ...(indexDecoy
      ? { "src/dep/index.ts": 'export const value = "wrong-index";' }
      : {}),
  });
  expect(run(root)).toBe("selected-main,selected-main,selected-main");
});

test("uses the emitted JSX extension for an extensionless TSX alias", () => {
  const root = fixture(
    {
      "src/main.ts": `import("src/component").then(mod => console.log(mod.value));`,
      "src/component.tsx": 'export const value = "jsx-output";',
    },
    { jsx: "preserve" },
  );
  expect(run(root)).toBe("jsx-output");
});

test("uses the source selected by moduleSuffixes", () => {
  const root = fixture(
    {
      "src/main.ts": `import("src/value").then(mod => console.log(mod.value));`,
      "src/value.native.ts": 'export const value = "native";',
      "src/value.ts": 'export const value = "wrong-default";',
    },
    { moduleSuffixes: [".native", ""] },
  );
  expect(run(root)).toBe("native");
});

test.each([
  false,
  true,
])("rewrites an empty wildcard match with a sibling file: %s", (sibling) => {
  const root = fixture(
    {
      "src/main.ts": `import("src/").then(mod => console.log(mod.value));`,
      "src/index.ts": 'export const value = "empty-match";',
      ...(sibling ? { "src.ts": 'export const value = "wrong-file";' } : {}),
    },
    { rootDir: "." },
  );
  expect(run(root, "dist/src/main.js")).toBe("empty-match");
});

test.each([
  "./src",
  undefined,
])("resolves path mappings with baseUrl %s", (baseUrl) => {
  const root = fixture(
    {
      "src/main.ts": `import("alias/value").then(mod => console.log(mod.value));`,
      "src/value.ts": 'export const value = "mapped";',
    },
    { baseUrl, paths: { "alias/*": [baseUrl ? "./*" : "./src/*"] } },
  );
  expect(run(root)).toBe("mapped");
});

test.each([
  { declarations: false, plainFile: true },
  { declarations: true, plainFile: true },
  { declarations: true, plainFile: false },
])("uses moduleSuffixes for external JavaScript (declarations: $declarations, plain file: $plainFile)", ({
  declarations,
  plainFile,
}) => {
  const root = fixture(
    {
      "src/main.ts": `
        import { value } from "vendor/value";
        import { exported } from "./exports";
        import("vendor/value").then(mod => console.log([value, exported, mod.value].join(",")));
      `,
      "src/exports.ts": 'export { value as exported } from "vendor/value";',
      "vendor/value.native.js": 'exports.value = "native-js";',
      ...(plainFile
        ? { "vendor/value.js": 'exports.value = "wrong-default";' }
        : {}),
      ...(declarations
        ? { "vendor/value.native.d.ts": "export declare const value: string;" }
        : {}),
    },
    { paths: { "vendor/*": ["./vendor/*"] }, moduleSuffixes: [".native", ""] },
  );
  expect(run(root)).toBe("native-js,native-js,native-js");
});

test("moduleSuffixes preserve explicit declaration-only mappings", () => {
  const root = fixture(
    {
      "src/main.ts": `import("vendor/value").then(mod => console.log(mod.value));`,
      "vendor/value.native.d.ts": "export declare const value: string;",
      "vendor/value.native.js": 'exports.value = "wrong-local";',
      "node_modules/vendor/value.js": 'exports.value = "package";',
    },
    {
      paths: { "vendor/*": ["./vendor/*.native.d.ts"] },
      moduleSuffixes: [".native", ""],
    },
  );
  expect(run(root)).toBe("package");
});

test("moduleSuffixes use package main when companion types live elsewhere", () => {
  const root = fixture(
    {
      "src/main.ts": `import("vendor/dep").then(mod => console.log(mod.value));`,
      "vendor/dep/package.json": JSON.stringify({
        types: "types/index.d.ts",
        main: "lib/entry.js",
      }),
      "vendor/dep/types/index.d.ts": "export declare const value: string;",
      "vendor/dep/types/index.native.js":
        'exports.value = "wrong-types-companion";',
      "vendor/dep/types/index.js": 'exports.value = "wrong-types-companion";',
      "vendor/dep/lib/entry.js": 'exports.value = "runtime-main";',
    },
    { paths: { "vendor/*": ["./vendor/*"] }, moduleSuffixes: [".native", ""] },
  );
  expect(run(root)).toBe("runtime-main");
});

test("retains nonzero exit and error reporting when emit is skipped", () => {
  const root = fixture(
    { "src/main.ts": `const value: string = 42;` },
    { noEmitOnError: true },
  );
  const result = compile(root);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("error emitting code");
  expect(fs.existsSync(path.join(root, "dist/main.js"))).toBe(false);
});
