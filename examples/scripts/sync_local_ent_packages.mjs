import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const appRoot = process.cwd();
const packageJSON = JSON.parse(
  await readFile(resolve(appRoot, "package.json"), "utf8"),
);
const dependencies = {
  ...packageJSON.dependencies,
  ...packageJSON.devDependencies,
};
const entPackages = Object.keys(dependencies).filter(
  (name) => name === "@snowtop/ent" || name.startsWith("@snowtop/ent-"),
);

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npm", ["--prefix", resolve(repoRoot, "ts"), "run", "prepare-code"]);

const packDir = await mkdtemp(resolve(tmpdir(), "ent-local-packages-"));
try {
  run("npm", [
    "pack",
    "--silent",
    resolve(repoRoot, "ts/dist"),
    "--pack-destination",
    packDir,
  ]);
  const coreTarballs = (await readdir(packDir)).filter((file) =>
    file.endsWith(".tgz"),
  );
  if (coreTarballs.length !== 1) {
    throw new Error(
      `expected one packed @snowtop/ent artifact, found ${coreTarballs.length}`,
    );
  }
  const coreTarball = resolve(packDir, coreTarballs[0]);

  for (const name of entPackages) {
    if (name === "@snowtop/ent") {
      continue;
    }
    const packageDir = resolve(
      repoRoot,
      "ts/packages",
      name.replace("@snowtop/", ""),
    );
    run("npm", ["ci"], packageDir);
    await rm(resolve(packageDir, "node_modules", "@snowtop", "ent"), {
      recursive: true,
      force: true,
    });
    run(
      "npm",
      ["install", "--no-save", "--package-lock=false", coreTarball],
      packageDir,
    );
    run("npm", ["run", "build"], packageDir);
    run("npm", [
      "pack",
      "--silent",
      packageDir,
      "--pack-destination",
      packDir,
    ]);
  }

  const tarballs = (await readdir(packDir))
    .filter((file) => file.endsWith(".tgz"))
    .map((file) => resolve(packDir, file));
  if (tarballs.length !== entPackages.length) {
    throw new Error(
      `expected ${entPackages.length} local Ent artifacts, found ${tarballs.length}`,
    );
  }
  for (const name of entPackages) {
    await rm(resolve(appRoot, "node_modules", ...name.split("/")), {
      recursive: true,
      force: true,
    });
  }
  run(
    "npm",
    ["install", "--no-save", "--package-lock=false", ...tarballs],
    appRoot,
  );
} finally {
  await rm(packDir, { recursive: true, force: true });
}

console.log(`Synced ${entPackages.join(", ")} into ${appRoot}`);
