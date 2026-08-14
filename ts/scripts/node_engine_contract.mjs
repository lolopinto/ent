import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const supportedNodeRange = ">=20.19.0 <21 || >=22.12.0";
const tsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(tsRoot, "..");

const packageDirectories = [
  "ts",
  "ts/packages/ent-email",
  "ts/packages/ent-graphql-tests",
  "ts/packages/ent-passport",
  "ts/packages/ent-password",
  "ts/packages/ent-pgvector",
  "ts/packages/ent-phonenumber",
  "ts/packages/ent-postgis",
  "ts/packages/ent-soft-delete",
  "examples/simple",
  "examples/todo-sqlite",
  "examples/ent-rsvp/backend",
  "examples/ent-local-guide",
  "examples/ent-semantic-notes",
];

async function readJSON(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

for (const directory of packageDirectories) {
  const manifest = await readJSON(`${directory}/package.json`);
  const lock = await readJSON(`${directory}/package-lock.json`);
  assert.equal(
    manifest.engines?.node,
    supportedNodeRange,
    `${directory}/package.json has a stale Node engine range`,
  );
  assert.equal(
    lock.packages?.[""]?.engines?.node,
    supportedNodeRange,
    `${directory}/package-lock.json root has a stale Node engine range`,
  );
}

for (const [lockPath, packageKey] of [
  [
    "examples/ent-local-guide/package-lock.json",
    "../../ts/packages/ent-postgis",
  ],
  [
    "examples/ent-semantic-notes/package-lock.json",
    "../../ts/packages/ent-pgvector",
  ],
]) {
  const lock = await readJSON(lockPath);
  assert.equal(
    lock.packages?.[packageKey]?.engines?.node,
    supportedNodeRange,
    `${lockPath} local companion metadata has a stale Node engine range`,
  );
}

process.stdout.write(
  `Node engine contract matches ${supportedNodeRange} across Ent, companions, examples, and locks\n`,
);
