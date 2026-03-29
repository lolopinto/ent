import fs from "fs";
import os from "os";
import path from "path";
import { isDevSchemaEnabled, resolveDevSchema } from "./dev_schema";

function writeHead(gitDir: string, head: string) {
  fs.mkdirSync(gitDir, { recursive: true });
  fs.writeFileSync(path.join(gitDir, "HEAD"), head, "utf8");
}

function makeRepo(branch: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ent-devschema-"));
  writeHead(path.join(dir, ".git"), `ref: refs/heads/${branch}`);
  return dir;
}

function makeDetachedRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ent-devschema-"));
  writeHead(path.join(dir, ".git"), "0123456789abcdef");
  return dir;
}

function makeWorktreeRepo(branch: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ent-devschema-"));
  writeHead(path.join(dir, ".gitdir"), `ref: refs/heads/${branch}`);
  fs.writeFileSync(path.join(dir, ".git"), "gitdir: .gitdir", "utf8");
  return dir;
}

function writeState(
  repo: string,
  state: {
    schemaName: string;
    branchName?: string;
    includePublic?: boolean;
    ignoreBranches?: string[];
  },
) {
  const stateDir = path.join(repo, "src", "schema", ".ent");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "dev_schema.json"),
    JSON.stringify(state),
    "utf8",
  );
}

describe("dev schema enablement", () => {
  const originalEnv = { ...process.env };
  const originalCwd = process.cwd();

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    process.chdir(originalCwd);
  });

  test("enabled false overrides schemaName", () => {
    const repo = makeRepo("main");
    process.chdir(repo);
    process.env.NODE_ENV = "development";
    delete process.env.ENT_DEV_SCHEMA_ENABLED;

    expect(isDevSchemaEnabled({ enabled: false, schemaName: "explicit" })).toBe(
      false,
    );
  });

  test("ignoreBranches disables on matching branch", () => {
    const repo = makeRepo("main");
    process.chdir(repo);
    process.env.NODE_ENV = "development";
    delete process.env.ENT_DEV_SCHEMA_ENABLED;

    expect(
      isDevSchemaEnabled({ enabled: true, ignoreBranches: ["main"] }),
    ).toBe(false);
  });

  test("env override enables even when ignored", () => {
    const repo = makeRepo("main");
    process.chdir(repo);
    process.env.NODE_ENV = "development";
    process.env.ENT_DEV_SCHEMA_ENABLED = "true";

    expect(
      isDevSchemaEnabled({ enabled: true, ignoreBranches: ["main"] }),
    ).toBe(true);
  });

  test("state ignoreBranches disables when no config provided", () => {
    const repo = makeRepo("main");
    process.chdir(repo);
    process.env.NODE_ENV = "development";
    delete process.env.ENT_DEV_SCHEMA_ENABLED;
    writeState(repo, {
      schemaName: "ent_dev_main_abcd1234",
      branchName: "main",
      ignoreBranches: ["main"],
    });

    expect(isDevSchemaEnabled()).toBe(false);
  });
});

describe("dev schema resolution", () => {
  const originalEnv = { ...process.env };
  const originalCwd = process.cwd();

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    process.chdir(originalCwd);
  });

  test("sanitizes explicit schemaName", () => {
    const repo = makeRepo("main");
    process.chdir(repo);
    process.env.NODE_ENV = "development";

    const res = resolveDevSchema({ enabled: true, schemaName: "123Bad" });
    expect(res.schemaName).toBe("schema_123bad");
  });

  test("runtime config derives schema without state", () => {
    const repo = makeRepo("feature/add-dev-schema");
    process.chdir(repo);
    process.env.NODE_ENV = "development";
    delete process.env.ENT_DEV_SCHEMA_ENABLED;

    const res = resolveDevSchema({ enabled: true, includePublic: true });
    expect(res.enabled).toBe(true);
    expect(res.branchName).toBe("feature/add-dev-schema");
    expect(res.includePublic).toBe(true);
    expect(res.schemaName).toMatch(
      /^ent_dev_feature_add_dev_schema_[0-9a-f]{8}$/,
    );
  });

  test("runtime config ignores stale state file and uses runtime settings", () => {
    const repo = makeRepo("main");
    process.chdir(repo);
    process.env.NODE_ENV = "development";
    delete process.env.ENT_DEV_SCHEMA_ENABLED;
    writeState(repo, {
      schemaName: "ent_dev_feature_abcd1234",
      branchName: "feature",
      includePublic: false,
    });

    const res = resolveDevSchema({ enabled: true, includePublic: true });
    expect(res.branchName).toBe("main");
    expect(res.includePublic).toBe(true);
    expect(res.schemaName).toMatch(/^ent_dev_main_[0-9a-f]{8}$/);
  });

  test("throws on branch mismatch when using state file", () => {
    const repo = makeRepo("main");
    process.chdir(repo);
    process.env.NODE_ENV = "development";
    writeState(repo, {
      schemaName: "ent_dev_feature_abcd1234",
      branchName: "feature",
    });

    expect(() => resolveDevSchema()).toThrow(
      /dev branch schema state was generated for branch "feature" but current branch is "main"/,
    );
  });

  test("throws when current branch cannot be determined in state-file mode", () => {
    const repo = makeDetachedRepo();
    process.chdir(repo);
    process.env.NODE_ENV = "development";
    writeState(repo, {
      schemaName: "ent_dev_feature_abcd1234",
      branchName: "feature",
    });

    expect(() => resolveDevSchema()).toThrow(/could not be determined/);
  });

  test("resolves worktree gitdir files", () => {
    const repo = makeWorktreeRepo("feature/worktree");
    process.chdir(repo);
    process.env.NODE_ENV = "development";
    delete process.env.ENT_DEV_SCHEMA_ENABLED;

    const res = resolveDevSchema({ enabled: true });
    expect(res.branchName).toBe("feature/worktree");
    expect(res.schemaName).toMatch(/^ent_dev_feature_worktree_[0-9a-f]{8}$/);
  });
});
