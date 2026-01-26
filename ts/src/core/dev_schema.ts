import * as fs from "fs";
import * as path from "path";
import type { DevSchemaConfig } from "./config";

const STATE_DIR = ".ent";
const STATE_FILE = "dev_schema.json";
const DEFAULT_SCHEMA_DIR = path.join("src", "schema");
const MAX_SCHEMA_LEN = 63;

export interface ResolvedDevSchema {
  enabled: boolean;
  schemaName?: string;
  branchName?: string;
  includePublic?: boolean;
}

interface DevSchemaState {
  schemaName: string;
  branchName?: string;
  includePublic?: boolean;
  ignoreBranches?: string[];
}

export function resolveDevSchema(cfg?: DevSchemaConfig): ResolvedDevSchema {
  if (!isDevSchemaEnabled(cfg)) {
    return { enabled: false };
  }

  if (cfg?.schemaName) {
    const schemaName = sanitizeIdentifier(cfg.schemaName);
    return {
      enabled: true,
      schemaName,
      includePublic: cfg.includePublic === true,
    };
  }

  const statePath = resolveStatePath();
  const state = loadDevSchemaState(statePath);
  if (!state?.schemaName) {
    throw new Error(
      "dev branch schemas are enabled but no dev schema state was found. Run ent codegen to generate src/schema/.ent/dev_schema.json.",
    );
  }

  const branchName = state.branchName;
  if (branchName) {
    const currentBranch = resolveGitBranch();
    if (currentBranch && currentBranch !== branchName) {
      throw new Error(
        `dev branch schema was generated for "${branchName}" but current branch is "${currentBranch}". Run ent codegen to regenerate.`,
      );
    }
  }

  return {
    enabled: true,
    schemaName: state.schemaName,
    branchName,
    includePublic: state.includePublic === true,
  };
}

export function isDevSchemaEnabled(cfg?: DevSchemaConfig): boolean {
  const nodeEnv = (process.env.NODE_ENV || "").toLowerCase();
  if (nodeEnv === "production") {
    return false;
  }

  const envEnabled = parseEnvBool("ENT_DEV_SCHEMA_ENABLED");
  if (envEnabled !== undefined) {
    return envEnabled;
  }
  if (cfg) {
    if (cfg.enabled !== true) {
      return false;
    }
    const branch = resolveGitBranch();
    if (isBranchIgnored(cfg.ignoreBranches, branch)) {
      return false;
    }
    return true;
  }
  const statePath = resolveStatePath();
  const state = loadDevSchemaState(statePath);
  if (!state?.schemaName) {
    return false;
  }
  const branch = resolveGitBranch();
  if (isBranchIgnored(state.ignoreBranches, branch)) {
    return false;
  }
  return true;
}

function loadDevSchemaState(statePath?: string): DevSchemaState | undefined {
  if (!statePath || !fs.existsSync(statePath)) {
    return undefined;
  }
  const raw = fs.readFileSync(statePath, "utf8");
  let data: DevSchemaState;
  try {
    data = JSON.parse(raw) as DevSchemaState;
  } catch (err) {
    throw new Error(`invalid dev schema state file at ${statePath}`);
  }
  if (!data || !data.schemaName) {
    return undefined;
  }
  return data;
}


function slugify(input: string): string {
  if (!input) {
    return "";
  }
  const lower = input.toLowerCase();
  let out = "";
  let lastUnderscore = false;
  for (const ch of lower) {
    const isAlpha = ch >= "a" && ch <= "z";
    const isDigit = ch >= "0" && ch <= "9";
    if (isAlpha || isDigit) {
      out += ch;
      lastUnderscore = false;
      continue;
    }
    if (!lastUnderscore) {
      out += "_";
      lastUnderscore = true;
    }
  }
  return out.replace(/^_+|_+$/g, "");
}

function sanitizeIdentifier(input: string): string {
  const slug = slugify(input);
  if (!slug) {
    return "schema";
  }
  let normalized = slug;
  if (normalized[0] >= "0" && normalized[0] <= "9") {
    normalized = `schema_${normalized}`;
  }
  if (normalized.length > MAX_SCHEMA_LEN) {
    return normalized.slice(0, MAX_SCHEMA_LEN);
  }
  return normalized;
}

function resolveStatePath(): string | undefined {
  const start = process.cwd();
  const root = findGitRoot(start) || start;
  const schemaDir = path.join(root, DEFAULT_SCHEMA_DIR);
  return path.join(schemaDir, STATE_DIR, STATE_FILE);
}

function isBranchIgnored(ignoreBranches: string[] | undefined, branch: string): boolean {
  if (!branch || !ignoreBranches || ignoreBranches.length === 0) {
    return false;
  }
  for (const name of ignoreBranches) {
    if (!name || !name.trim()) {
      continue;
    }
    if (name === branch) {
      return true;
    }
  }
  return false;
}

function parseEnvBool(key: string): boolean | undefined {
  const raw = process.env[key];
  if (!raw) {
    return undefined;
  }
  const val = raw.trim().toLowerCase();
  if (["1", "true", "t", "yes", "y"].includes(val)) {
    return true;
  }
  if (["0", "false", "f", "no", "n"].includes(val)) {
    return false;
  }
  return undefined;
}

function resolveGitBranch(): string {
  const start = process.cwd();
  const root = findGitRoot(start);
  if (!root) {
    return "";
  }
  const gitDir = resolveGitDir(path.join(root, ".git"));
  if (!gitDir) {
    return "";
  }
  const headPath = path.join(gitDir, "HEAD");
  if (!fs.existsSync(headPath)) {
    return "";
  }
  const head = fs.readFileSync(headPath, "utf8").trim();
  if (!head.startsWith("ref:")) {
    return "";
  }
  return head.replace("ref:", "").trim().replace(/^refs\/heads\//, "");
}

function resolveGitDir(gitPath: string): string | undefined {
  if (!fs.existsSync(gitPath)) {
    return undefined;
  }
  const stat = fs.statSync(gitPath);
  if (stat.isDirectory()) {
    return gitPath;
  }
  const contents = fs.readFileSync(gitPath, "utf8").trim();
  if (!contents.startsWith("gitdir:")) {
    return undefined;
  }
  let dir = contents.replace("gitdir:", "").trim();
  if (!path.isAbsolute(dir)) {
    dir = path.join(path.dirname(gitPath), dir);
  }
  return dir;
}

function findGitRoot(start: string): string | undefined {
  let dir = start;
  while (true) {
    const gitPath = path.join(dir, ".git");
    if (fs.existsSync(gitPath)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}
