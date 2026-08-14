import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const expectedNodeVersion = "22.11.0";
const expectedEngineRange = ">=20.19.0 <21 || >=22.12.0";
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);
const packageJSON = JSON.parse(
  await readFile(path.join(packageRoot, "package.json"), "utf8"),
);

assert.equal(
  process.versions.node,
  expectedNodeVersion,
  `unsupported-boundary smoke must run on Node ${expectedNodeVersion}`,
);
assert.equal(packageJSON.engines?.node, expectedEngineRange);

const esmResult = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    'const ent = await import("@snowtop/ent"); if (typeof ent.DB !== "function") process.exit(1);',
  ],
  {
    cwd: packageRoot,
    encoding: "utf8",
  },
);
assert.equal(esmResult.status, 0, esmResult.stderr);

const commonJSResult = spawnSync(
  process.execPath,
  ["--input-type=commonjs", "--eval", 'require("@snowtop/ent")'],
  {
    cwd: packageRoot,
    encoding: "utf8",
  },
);
assert.notEqual(
  commonJSResult.status,
  0,
  "Node 22.11 unexpectedly loaded Ent's ESM graph with require()",
);
assert.match(commonJSResult.stderr, /ERR_REQUIRE_ESM/);

process.stdout.write(
  "Node 22.11 remains ESM-importable, is excluded by engines, and rejects CommonJS require as expected\n",
);
