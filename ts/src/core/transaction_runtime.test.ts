import { spawnSync } from "child_process";
import path from "path";

const fixture = path.join(__dirname, "../testutils/transaction_runtime.js");
const bun = spawnSync("bun", ["--version"], { encoding: "utf8" });

test("transaction scope in real Node/pg runtime", () => {
  const result = spawnSync(
    process.execPath,
    ["-r", "ts-node/register", fixture, "pg"],
    {
      encoding: "utf8",
      timeout: 30000,
    },
  );
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("transaction runtime passed: node/pg");
}, 35000);

(bun.status === 0 ? describe : describe.skip)("Bun transaction scope", () => {
  test.each(["pg", "bun"])("real Bun runtime with %s driver", (driver) => {
    const result = spawnSync("bun", [fixture, driver], {
      encoding: "utf8",
      timeout: 30000,
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      `transaction runtime passed: bun/${driver}`,
    );
  }, 35000);
});
