import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDynamicTypeScriptCommand } from "./dynamic_tsx.js";

test("package-owned tsx launcher works without node_modules/.bin on PATH", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "ent-dynamic-tsx-"));
  try {
    const scriptPath = path.join(directory, "dynamic.ts");
    writeFileSync(
      scriptPath,
      "const result: { ok: boolean } = { ok: true }; console.log(JSON.stringify(result));",
    );
    const { command, args } = getDynamicTypeScriptCommand(scriptPath, "node");
    const result = spawnSync(command, args, {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: "/ent-test-path-without-node-modules-bin",
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ ok: true });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Bun dynamic execution remains direct", () => {
  expect(getDynamicTypeScriptCommand("dynamic.ts", "bun")).toEqual({
    command: "bun",
    args: ["dynamic.ts"],
  });
});
