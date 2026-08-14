import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const tsRoot = path.resolve(scriptDir, "..");
const companionRoot = path.resolve(process.argv[2] || "");
const packageJSON = JSON.parse(
  await readFile(path.join(companionRoot, "package.json"), "utf8"),
);
const packageName = packageJSON.name;

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result;
}

const source = `
  const assert = require("node:assert/strict");

  void (async () => {
    const entPackage = require("@snowtop/ent/package.json");
    const requiredEnt = require("@snowtop/ent");
    const importedEnt = await import("@snowtop/ent");
    const requiredCompanion = require(${JSON.stringify(packageName)});
    const importedCompanion = await import(${JSON.stringify(packageName)});

    assert.equal(entPackage.type, "module");
    assert.equal(entPackage.entToolingContract, 1);
    assert.strictEqual(requiredEnt.DB, importedEnt.DB);
    assert.ok(Object.keys(importedCompanion).length > 0);
    assert.deepEqual(
      Object.keys(requiredCompanion).sort(),
      Object.keys(importedCompanion).sort(),
    );
    for (const key of Object.keys(importedCompanion)) {
      assert.strictEqual(requiredCompanion[key], importedCompanion[key]);
    }
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
`;

const tempRoot = await mkdtemp(path.join(tmpdir(), "ent-companion-smoke-"));
const packDir = path.join(tempRoot, "packages");
const consumerDir = path.join(tempRoot, "consumer");
try {
  await Promise.all([
    mkdir(packDir),
    mkdir(consumerDir),
    writeFile(
      path.join(tempRoot, "package.json"),
      JSON.stringify({ private: true }),
    ),
  ]);
  run(
    "npm",
    [
      "pack",
      "--silent",
      path.join(tsRoot, "dist"),
      "--pack-destination",
      packDir,
    ],
    tempRoot,
  );
  run(
    "npm",
    ["pack", "--silent", companionRoot, "--pack-destination", packDir],
    tempRoot,
  );
  const tarballs = (await readdir(packDir))
    .filter((file) => file.endsWith(".tgz"))
    .map((file) => path.join(packDir, file));
  if (tarballs.length !== 2) {
    throw new Error(`expected two package tarballs, found ${tarballs.length}`);
  }

  await writeFile(
    path.join(consumerDir, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }),
  );
  run(
    "npm",
    ["install", "--no-save", "--package-lock=false", ...tarballs],
    consumerDir,
    { stdio: "inherit" },
  );
  run(
    process.execPath,
    ["--input-type=commonjs", "--eval", source],
    consumerDir,
    {
      stdio: "inherit",
    },
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

process.stdout.write(
  `${packageName} packed import/require package smoke passed\n`,
);
