import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { RuntimeDevSchemaConfig } from "./config";

const STATE_DIR = ".ent";
const STATE_FILE = "dev_schema.json";
const DEFAULT_SCHEMA_DIR = path.join("src", "schema");
const DEFAULT_SCHEMA_PREFIX = "ent_dev";
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

export function resolveDevSchema(
  cfg?: RuntimeDevSchemaConfig,
): ResolvedDevSchema {
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

  if (cfg) {
    const branchName = requireCurrentBranch(
      "dev branch schemas are enabled but the current git branch could not be determined. Set devSchema.schemaName explicitly.",
    );
    return {
      enabled: true,
      schemaName: buildSchemaName(branchName),
      branchName,
      includePublic: cfg.includePublic === true,
    };
  }

  const state = loadDevSchemaState(resolveStatePath());
  if (state?.schemaName) {
    const branchName = state.branchName;
    if (branchName) {
      // State-file mode is tied to the branch that produced the generated
      // schema metadata. Fail closed after branch switches until codegen
      // refreshes the state file.
      const currentBranch = requireCurrentBranch(
        `dev branch schema state was generated for branch "${branchName}" but the current git branch could not be determined. Run ent codegen to regenerate or set devSchema.schemaName explicitly.`,
      );
      if (currentBranch !== branchName) {
        throw new Error(
          `dev branch schema state was generated for branch "${branchName}" but current branch is "${currentBranch}". Run ent codegen to regenerate or set devSchema.schemaName explicitly.`,
        );
      }
    }

    return {
      enabled: true,
      schemaName: sanitizeIdentifier(state.schemaName),
      branchName,
      includePublic: state.includePublic === true,
    };
  }

  const branchName = requireCurrentBranch(
    "dev branch schemas are enabled but the current git branch could not be determined. Set devSchema.schemaName explicitly or run ent codegen to regenerate src/schema/.ent/dev_schema.json.",
  );
  return {
    enabled: true,
    schemaName: buildSchemaName(branchName),
    branchName,
    includePublic: false,
  };
}

export function isDevSchemaEnabled(cfg?: RuntimeDevSchemaConfig): boolean {
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
  const state = loadDevSchemaState(resolveStatePath());
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

function requireCurrentBranch(message: string): string {
  const branch = resolveGitBranch();
  if (!branch) {
    throw new Error(message);
  }
  return branch;
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

function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 8);
}

function buildSchemaName(branch: string): string {
  const prefix = sanitizeIdentifier(DEFAULT_SCHEMA_PREFIX);
  let branchSlug = slugify(branch);
  if (!branchSlug) {
    branchSlug = "branch";
  }
  const hash = shortHash(branch);
  let name = [prefix, branchSlug, hash].join("_");
  if (name.length <= MAX_SCHEMA_LEN) {
    return name;
  }

  const over = name.length - MAX_SCHEMA_LEN;
  if (over > 0 && branchSlug.length > 1) {
    branchSlug = branchSlug.slice(
      0,
      branchSlug.length - Math.min(over, branchSlug.length - 1),
    );
  }
  name = [prefix, branchSlug, hash].join("_");
  if (name.length > MAX_SCHEMA_LEN) {
    return name.slice(0, MAX_SCHEMA_LEN);
  }
  return name;
}

function resolveStatePath(): string | undefined {
  const start = process.cwd();
  const root = findGitRoot(start) || start;
  const schemaDir = path.join(root, DEFAULT_SCHEMA_DIR);
  return path.join(schemaDir, STATE_DIR, STATE_FILE);
}

function isBranchIgnored(
  ignoreBranches: string[] | undefined,
  branch: string,
): boolean {
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
  return head
    .replace("ref:", "")
    .trim()
    .replace(/^refs\/heads\//, "");
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
