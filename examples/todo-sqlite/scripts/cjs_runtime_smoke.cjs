const assert = require("node:assert/strict");

void (async () => {
  const entPackage = require("@snowtop/ent/package.json");
  const requiredEnt = require("@snowtop/ent");
  const importedEnt = await import("@snowtop/ent");
  const generatedEnt = require("../dist/ent/index.js");

  assert.equal(entPackage.type, "module");
  assert.equal(entPackage.entToolingContract, 1);
  assert.strictEqual(requiredEnt.DB, importedEnt.DB);
  assert.equal(typeof generatedEnt.Account, "function");
  assert.equal(typeof generatedEnt.Todo, "function");
  process.stdout.write("compiled CommonJS application smoke passed\n");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
