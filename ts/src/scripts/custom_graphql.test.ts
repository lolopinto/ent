import { spawn } from "child_process";
import { mkdtemp, mkdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";

describe("custom_graphql script", () => {
  test("exits after writing output when an imported module leaves an active handle", async () => {
    const fixtureRoot = await mkdtemp(
      path.join(tmpdir(), "ent-custom-graphql-"),
    );
    const sourcePath = path.join(fixtureRoot, "src");
    await mkdir(sourcePath);
    await writeFile(
      path.join(sourcePath, "active_handle.js"),
      "setInterval(() => {}, 1000);\n",
    );

    try {
      const result = await new Promise<{
        code: number | null;
        stdout: string;
        stderr: string;
        timedOut: boolean;
      }>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            "-r",
            "ts-node/register/transpile-only",
            "-r",
            "tsconfig-paths/register",
            path.join(__dirname, "custom_graphql.ts"),
            "--path",
            sourcePath,
            "--files",
            "src/active_handle.js",
          ],
          {
            cwd: path.resolve(__dirname, "../.."),
            env: {
              ...process.env,
              GRAPHQL_PATH: "local",
              LOCAL_SCRIPT_PATH: "1",
            },
          },
        );
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });
        child.on("error", reject);
        child.on("close", (code) => {
          clearTimeout(timeout);
          resolve({ code, stdout, stderr, timedOut });
        });
        child.stdin.end();

        const timeout = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, 3000);
      });

      expect(result.timedOut).toBe(false);
      expect(result.code).toBe(0);
      expect(result.stderr).toBe("");
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  }, 10000);
});
