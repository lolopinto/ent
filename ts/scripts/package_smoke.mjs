import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);

const esmSmoke = `
  import assert from "node:assert/strict";
  import packageJSON from "@snowtop/ent/package.json" with { type: "json" };

  const root = await import("@snowtop/ent");
  const action = await import("@snowtop/ent/action");
  const auth = await import("@snowtop/ent/auth");
  const graphql = await import("@snowtop/ent/graphql");
  const schema = await import("@snowtop/ent/schema");
  const db = await import("@snowtop/ent/core/db");
  const entRuntime = await import("@snowtop/ent/core/ent");
  const gqlRuntime = await import("@snowtop/ent/graphql/graphql.js");
  const upload = await import("@snowtop/ent/graphql/upload");

  assert.equal(packageJSON.type, "module");
  assert.equal(packageJSON.entToolingContract, 1);
  assert.equal(typeof root.DB, "function");
  assert.equal(typeof action.Orchestrator, "function");
  assert.equal(typeof auth.buildContext, "function");
  assert.equal(typeof graphql.GQLCapture, "function");
  assert.equal(typeof schema.EntSchema, "function");
  assert.strictEqual(root.DB, db.default);
  assert.equal(typeof entRuntime.loadEntX, "function");
  assert.strictEqual(graphql.GQLCapture, gqlRuntime.GQLCapture);
  assert.equal(typeof upload.graphqlUploadExpress, "function");
  await assert.rejects(() => import("@snowtop/ent/schema/"), {
    code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
  });
`;

const commonJSSmoke = `
  const assert = require("node:assert/strict");

  void (async () => {
    const packageJSON = require("@snowtop/ent/package.json");
    const root = require("@snowtop/ent");
    const action = require("@snowtop/ent/action");
    const auth = require("@snowtop/ent/auth");
    const graphql = require("@snowtop/ent/graphql");
    const schema = require("@snowtop/ent/schema");
    const db = require("@snowtop/ent/core/db");
    const entRuntime = require("@snowtop/ent/core/ent");
    const gqlRuntime = require("@snowtop/ent/graphql/graphql.js");
    const upload = require("@snowtop/ent/graphql/upload");
    const importedRoot = await import("@snowtop/ent");
    const importedGQL = await import("@snowtop/ent/graphql/graphql.js");

    assert.equal(packageJSON.type, "module");
    assert.equal(packageJSON.entToolingContract, 1);
    assert.equal(typeof root.DB, "function");
    assert.equal(typeof action.Orchestrator, "function");
    assert.equal(typeof auth.buildContext, "function");
    assert.equal(typeof graphql.GQLCapture, "function");
    assert.equal(typeof schema.EntSchema, "function");
    assert.strictEqual(root.DB, db.default);
    assert.equal(typeof entRuntime.loadEntX, "function");
    assert.strictEqual(graphql.GQLCapture, gqlRuntime.GQLCapture);
    assert.equal(typeof upload.graphqlUploadExpress, "function");
    assert.strictEqual(root.DB, importedRoot.DB);
    assert.strictEqual(gqlRuntime.GQLCapture, importedGQL.GQLCapture);
    assert.throws(() => require("@snowtop/ent/schema/"), {
      code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
    });
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
`;

for (const [name, inputType, source] of [
  ["ESM import", "module", esmSmoke],
  ["CommonJS require", "commonjs", commonJSSmoke],
]) {
  const result = spawnSync(
    process.execPath,
    [`--input-type=${inputType}`, "--eval", source],
    {
      cwd: packageRoot,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`${name} package smoke failed`);
  }
  process.stdout.write(`${name} package smoke passed\n`);
}
