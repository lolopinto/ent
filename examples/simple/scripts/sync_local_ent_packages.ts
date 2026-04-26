import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { dirname, join, resolve } from "path";

const exampleRoot = resolve(import.meta.dir, "..");
const repoRoot = resolve(exampleRoot, "../..");
const tsRoot = join(repoRoot, "ts");
const entDist = join(tsRoot, "dist");
const entGraphQLTestsRoot = join(tsRoot, "packages/ent-graphql-tests");

function requireDir(path: string) {
  if (!existsSync(path)) {
    throw new Error(
      `${path} does not exist. Run npm --prefix ../../ts run compile first.`,
    );
  }
}

function syncPackage(src: string, dest: string) {
  requireDir(src);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true, dereference: true });
}

syncPackage(entDist, join(exampleRoot, "node_modules/@snowtop/ent"));
cpSync(
  join(tsRoot, "package.json"),
  join(exampleRoot, "node_modules/@snowtop/ent/package.json"),
);

const entGraphQLTestsDest = join(
  exampleRoot,
  "node_modules/@snowtop/ent-graphql-tests",
);
rmSync(entGraphQLTestsDest, { recursive: true, force: true });
syncPackage(
  join(entGraphQLTestsRoot, "dist"),
  join(entGraphQLTestsDest, "dist"),
);
cpSync(
  join(entGraphQLTestsRoot, "package.json"),
  join(entGraphQLTestsDest, "package.json"),
);
