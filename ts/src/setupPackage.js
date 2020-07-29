const fs = requre("fs");
const path = require("path");

// root is for some reason "ts/"
const root = path.resolve();

// DO NOT DELETE THIS FILE
// This file is used by build system to build a clean npm package with the compiled js files in the root of the package.
// It will not be included in the npm package.
// gotten from https://stackoverflow.com/questions/38935176/how-to-npm-publish-specific-folder-but-as-package-root
function main() {
  const source = fs
    .readFileSync(path.join(root, "package.json"))
    .toString("utf-8");
  const sourceObj = JSON.parse(source);
  sourceObj.scripts = {};
  sourceObj.devDependencies = {};
  if (sourceObj.main.startsWith("dist/")) {
    sourceObj.main = sourceObj.main.slice(5);
  }
  fs.writeFileSync(
    path.join(root, "dist", "/package.json"),
    Buffer.from(JSON.stringify(sourceObj, null, 2), "utf-8"),
  );

  fs.copyFileSync(
    path.join(root, ".npmignore"),
    path.join(root, "dist", ".npmignore"),
  );
}

main();
