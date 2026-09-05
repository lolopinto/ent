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

function run(root: string) {
  const compiled = compile(root);
  expect({
    status: compiled.status,
    stderr: compiled.stderr,
    error: compiled.error,
  }).toEqual({ status: 0, stderr: "", error: undefined });
  const result = spawnSync(process.execPath, ["dist/main.js"], {
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
