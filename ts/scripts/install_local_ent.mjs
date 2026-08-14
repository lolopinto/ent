import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const tsRoot = path.resolve(scriptDir, "..");
const companionRoot = path.resolve(process.argv[2] || "");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const packDir = await mkdtemp(path.join(tmpdir(), "ent-core-package-"));
try {
  run(
    "npm",
    [
      "pack",
      "--silent",
      path.resolve(tsRoot, "dist"),
      "--pack-destination",
      packDir,
    ],
    tsRoot,
  );
  const tarballs = (await readdir(packDir)).filter((file) =>
    file.endsWith(".tgz"),
  );
  if (tarballs.length !== 1) {
    throw new Error(`expected one Ent tarball, found ${tarballs.length}`);
  }
  await rm(path.join(companionRoot, "node_modules", "@snowtop", "ent"), {
    recursive: true,
    force: true,
  });
  run(
    "npm",
    [
      "install",
      "--no-save",
      "--package-lock=false",
      path.join(packDir, tarballs[0]),
    ],
    companionRoot,
  );
} finally {
  await rm(packDir, { recursive: true, force: true });
}
