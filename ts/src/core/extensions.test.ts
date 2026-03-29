import fs from "fs";
import os from "os";
import path from "path";
import type { Pool } from "pg";
import {
  buildExtensionSearchPath,
  clearExtensionRuntimes,
  initializeExtensions,
  registerExtensionRuntime,
  resolveExtensions,
} from "./extensions";

function writeHead(gitDir: string, head: string) {
  fs.mkdirSync(gitDir, { recursive: true });
  fs.writeFileSync(path.join(gitDir, "HEAD"), head, "utf8");
}

function makeRepo(branch: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ent-extensions-"));
  writeHead(path.join(dir, ".git"), `ref: refs/heads/${branch}`);
  return dir;
}

function writeState(
  repo: string,
  state: {
    extensions: Array<{
      name: string;
      managed?: boolean;
      version?: string;
      installSchema?: string;
      runtimeSchemas?: string[];
      dropCascade?: boolean;
    }>;
  },
) {
  const stateDir = path.join(repo, "src", "schema", ".ent");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "extensions.json"),
    JSON.stringify(state),
    "utf8",
  );
}

describe("extension state resolution", () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
  });

  test("loads generated state when config is absent", () => {
    const repo = makeRepo("main");
    process.chdir(repo);
    writeState(repo, {
      extensions: [
        {
          name: "vector",
        },
        {
          name: "postgis",
          runtimeSchemas: ["public"],
        },
      ],
    });

    expect(resolveExtensions()).toEqual([
      {
        name: "postgis",
        managed: true,
        runtimeSchemas: ["public"],
        dropCascade: false,
      },
      {
        name: "vector",
        managed: true,
        runtimeSchemas: [],
        dropCascade: false,
      },
    ]);
  });

  test("runtime config overrides generated state", () => {
    const repo = makeRepo("main");
    process.chdir(repo);
    writeState(repo, {
      extensions: [
        {
          name: "postgis",
          runtimeSchemas: ["public"],
        },
      ],
    });

    expect(resolveExtensions([])).toEqual([]);
  });
});

describe("extension search path", () => {
  test("combines dev schema and extension schemas", () => {
    expect(
      buildExtensionSearchPath(
        {
          enabled: true,
          schemaName: "ent_dev_feature",
          includePublic: true,
        },
        [
          {
            name: "vector",
            runtimeSchemas: ["extensions"],
          },
          {
            name: "postgis",
            runtimeSchemas: ["public"],
          },
        ],
      ),
    ).toBe("ent_dev_feature,public,extensions");
  });

  test("returns undefined when nothing contributes to search path", () => {
    expect(
      buildExtensionSearchPath(
        {
          enabled: false,
        },
        [],
      ),
    ).toBeUndefined();
  });

  test("keeps public available outside dev schema mode", () => {
    expect(
      buildExtensionSearchPath(
        {
          enabled: false,
        },
        [
          {
            name: "vector",
            runtimeSchemas: ["extensions"],
          },
        ],
      ),
    ).toBe("extensions,public");
  });
});

describe("extension initialization", () => {
  afterEach(() => {
    clearExtensionRuntimes();
  });

  test("validates installed extensions and calls runtime hooks", async () => {
    const validate = jest.fn();
    const initialize = jest.fn();
    registerExtensionRuntime({
      name: "postgis",
      validate,
      initialize,
    });

    const pool = {
      query: jest.fn().mockResolvedValue({
        rows: [{ extname: "postgis", extversion: "3.4.0" }],
      }),
    } as unknown as Pool;

    await initializeExtensions(pool, [
      {
        name: "postgis",
        version: "3.4.0",
      },
    ]);

    expect(validate).toHaveBeenCalledWith(
      {
        name: "postgis",
        version: "3.4.0",
      },
      {
        name: "postgis",
        managed: true,
        runtimeSchemas: [],
        dropCascade: false,
        version: "3.4.0",
      },
    );
    expect(initialize).toHaveBeenCalled();
  });

  test("throws when a required extension is missing", async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({
        rows: [],
      }),
    } as unknown as Pool;

    await expect(
      initializeExtensions(pool, [
        {
          name: "vector",
        },
      ]),
    ).rejects.toThrow('required db extension "vector" is not installed');
  });
});
