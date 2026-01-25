import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import type { DevSchemaConfig } from "./config";

const DEFAULT_PREFIX = "ent_dev";
const MAX_SCHEMA_LEN = 63;

export interface ResolvedDevSchema {
  enabled: boolean;
  schemaName?: string;
  includePublic: boolean;
  branchName?: string;
  prefix?: string;
}

export function resolveDevSchema(cfg?: DevSchemaConfig): ResolvedDevSchema {
  const nodeEnv = (process.env.NODE_ENV || "").toLowerCase();
  if (nodeEnv === "production") {
    return { enabled: false, includePublic: true };
  }

  const envEnabled = parseEnvBool(
    "ENT_DEV_SCHEMA_ENABLED",
    "ENT_DEV_BRANCH_SCHEMAS",
  );

  let enabled = false;
  if (envEnabled !== undefined) {
    enabled = envEnabled;
  } else if (cfg?.enabled) {
    enabled = true;
  }

  let schemaName = firstEnv("ENT_DEV_SCHEMA_NAME") || cfg?.schemaName || "";
  if (schemaName) {
    enabled = true;
  }

  if (!enabled) {
    return { enabled: false, includePublic: true };
  }

  let includePublic =
    parseEnvBool("ENT_DEV_SCHEMA_INCLUDE_PUBLIC") ??
    cfg?.includePublic ??
    true;

  let branchName = cfg?.branchName || "";

  const prefix =
    firstEnv("ENT_DEV_SCHEMA_PREFIX") || cfg?.prefix || DEFAULT_PREFIX;

  if (!schemaName) {
    if (!branchName) {
      branchName = resolveGitBranch();
    }
    if (!branchName) {
      return {
        enabled: true,
        includePublic,
        prefix,
      };
    }
    const suffix = firstEnv("ENT_DEV_SCHEMA_SUFFIX") || cfg?.suffix || "";
    schemaName = buildSchemaName(prefix, branchName, suffix);
  } else {
    schemaName = sanitizeIdentifier(schemaName);
  }

  return {
    enabled: true,
    schemaName,
    includePublic,
    branchName,
    prefix,
  };
}

function buildSchemaName(prefix: string, branch: string, suffix: string): string {
  const branchSlug = slugify(branch) || "branch";
  const hash = shortHash(branch);
  let parts = [sanitizeIdentifier(prefix), branchSlug, hash];
  if (suffix) {
    parts.push(slugify(suffix));
  }
  let name = parts.join("_");
  if (name.length <= MAX_SCHEMA_LEN) {
    return name;
  }

  let over = name.length - MAX_SCHEMA_LEN;
  if (over > 0 && branchSlug.length > 1) {
    const trim = Math.min(over, branchSlug.length - 1);
    parts[1] = branchSlug.slice(0, branchSlug.length - trim);
    over -= trim;
  }
  if (over > 0 && suffix) {
    const suffixSlug = slugify(suffix);
    if (suffixSlug.length > 1) {
      const trim = Math.min(over, suffixSlug.length - 1);
      parts[3] = suffixSlug.slice(0, suffixSlug.length - trim);
      over -= trim;
    }
  }
  name = parts.filter(Boolean).join("_");
  if (name.length > MAX_SCHEMA_LEN) {
    return name.slice(0, MAX_SCHEMA_LEN);
  }
  return name;
}

function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 8);
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
    const isNum = ch >= "0" && ch <= "9";
    if (isAlpha || isNum) {
      out += ch;
      lastUnderscore = false;
    } else if (!lastUnderscore) {
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
  return slug.slice(0, MAX_SCHEMA_LEN);
}

function parseEnvBool(...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw) {
      continue;
    }
    const val = raw.trim().toLowerCase();
    if (["1", "true", "t", "yes", "y"].includes(val)) {
      return true;
    }
    if (["0", "false", "f", "no", "n"].includes(val)) {
      return false;
    }
  }
  return undefined;
}

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = process.env[key];
    if (val) {
      return val;
    }
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
