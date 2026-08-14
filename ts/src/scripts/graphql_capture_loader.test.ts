import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  loadGraphQLModule,
  resolveGraphQLPath,
} from "./graphql_capture_loader.js";

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function createAppRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "ent-graphql-loader-"));
  tempDirs.push(root);
  const src = path.join(root, "src");
  const packageDir = path.join(root, "node_modules", "@snowtop", "ent");
  await mkdir(src, { recursive: true });
  await mkdir(packageDir, { recursive: true });
  await writeFile(
    path.join(packageDir, "package.json"),
    JSON.stringify({
      name: "@snowtop/ent",
      exports: {
        "./graphql": "./graphql.cjs",
      },
    }),
  );
  await writeFile(
    path.join(packageDir, "graphql.cjs"),
    "module.exports = { source: 'installed' };\n",
  );
  return { root, src, packageDir };
}

test("explicit GraphQL path overrides app package resolution", async () => {
  const { root, src, packageDir } = await createAppRoot();
  const override = path.join(root, "override.cjs");
  await writeFile(override, "module.exports = { source: 'override' };\n");

  expect(resolveGraphQLPath(src, "@snowtop/ent/graphql", override)).toBe(
    override,
  );
  expect(resolveGraphQLPath(src, "@snowtop/ent/graphql")).toBe(
    await realpath(path.join(packageDir, "graphql.cjs")),
  );
});

test("CommonJS loads the selected GraphQL module through the app graph", async () => {
  const { root, src } = await createAppRoot();
  const override = path.join(root, "override.cjs");
  await writeFile(override, "module.exports = { source: 'override' };\n");

  const loaded = await loadGraphQLModule<{ source: string }>({
    filePath: src,
    graphqlPath: override,
    explicitGraphQLPath: true,
    moduleFormat: "commonjs",
    runtime: "node",
    localScriptPath: false,
  });
  expect(loaded.source).toBe("override");
});

test("ESM imports the selected GraphQL module", async () => {
  const { root, src } = await createAppRoot();
  const override = path.join(root, "override-esm");
  await mkdir(override);
  await writeFile(
    path.join(override, "package.json"),
    JSON.stringify({ type: "module", main: "./index.mjs" }),
  );
  await writeFile(
    path.join(override, "index.mjs"),
    "export const source = 'override';\n",
  );

  const loaded = await loadGraphQLModule<{ source: string }>({
    filePath: src,
    graphqlPath: override,
    explicitGraphQLPath: true,
    moduleFormat: "esm",
    runtime: "node",
    localScriptPath: false,
  });
  expect(loaded.source).toBe("override");
});

test.each([
  { runtime: "node", localScriptPath: true },
  { runtime: "bun", localScriptPath: false },
])("explicit GraphQL path wins for $runtime local=$localScriptPath", async ({
  runtime,
  localScriptPath,
}) => {
  const { root, src } = await createAppRoot();
  const override = path.join(root, `override-${runtime}.mjs`);
  await writeFile(override, "export const source = 'override';\n");

  const loaded = await loadGraphQLModule<{ source: string }>({
    filePath: src,
    graphqlPath: override,
    explicitGraphQLPath: true,
    moduleFormat: "esm",
    runtime,
    localScriptPath,
  });
  expect(loaded.source).toBe("override");
});
