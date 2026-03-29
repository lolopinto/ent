import fs from "fs";
import path from "path";
import type { Pool } from "pg";
import type { RuntimeDBExtension } from "./config";
import type { ResolvedDevSchema } from "./dev_schema";

const STATE_DIR = ".ent";
const STATE_FILE = "extensions.json";
const DEFAULT_SCHEMA_DIR = path.join("src", "schema");

interface ExtensionsState {
  extensions?: RuntimeDBExtension[];
}

export interface InstalledDBExtension {
  name: string;
  version: string;
}

export interface ExtensionRuntimeHandler {
  name: string;
  validate?(
    installed: InstalledDBExtension,
    extension: RuntimeDBExtension,
  ): void | Promise<void>;
  initialize?(
    pool: Pool,
    installed: InstalledDBExtension,
    extension: RuntimeDBExtension,
  ): void | Promise<void>;
}

const runtimeHandlers = new Map<string, ExtensionRuntimeHandler>();

export function registerExtensionRuntime(handler: ExtensionRuntimeHandler) {
  runtimeHandlers.set(handler.name, handler);
}

export function clearExtensionRuntimes() {
  runtimeHandlers.clear();
}

export function normalizeExtensions(
  extensions: RuntimeDBExtension[],
): RuntimeDBExtension[] {
  return [...extensions]
    .map((extension) => ({
      ...extension,
      managed: extension.managed !== false,
      runtimeSchemas: extension.runtimeSchemas || [],
      dropCascade: extension.dropCascade === true,
    }))
    .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
}

export function resolveExtensions(
  cfg?: RuntimeDBExtension[],
): RuntimeDBExtension[] {
  if (cfg !== undefined) {
    return normalizeExtensions(cfg);
  }
  const state = loadExtensionsState(resolveStatePath());
  if (!state?.extensions?.length) {
    return [];
  }
  return normalizeExtensions(state.extensions);
}

export function getExtensionSearchPathSchemas(
  extensions: RuntimeDBExtension[],
): string[] {
  const seen = new Set<string>();
  const schemas: string[] = [];
  for (const extension of normalizeExtensions(extensions)) {
    for (const schema of extension.runtimeSchemas || []) {
      if (!schema || seen.has(schema)) {
        continue;
      }
      seen.add(schema);
      schemas.push(schema);
    }
  }
  return schemas;
}

export function buildExtensionSearchPath(
  resolvedDevSchema: ResolvedDevSchema,
  extensions: RuntimeDBExtension[],
): string | undefined {
  const schemas: string[] = [];
  if (resolvedDevSchema.enabled && resolvedDevSchema.schemaName) {
    schemas.push(resolvedDevSchema.schemaName);
  }
  for (const schema of getExtensionSearchPathSchemas(extensions)) {
    if (!schemas.includes(schema)) {
      schemas.push(schema);
    }
  }
  if (
    resolvedDevSchema.enabled &&
    resolvedDevSchema.includePublic &&
    !schemas.includes("public")
  ) {
    schemas.push("public");
  }
  if (
    !resolvedDevSchema.enabled &&
    schemas.length > 0 &&
    !schemas.includes("public")
  ) {
    schemas.push("public");
  }
  if (schemas.length === 0) {
    return undefined;
  }
  return schemas.join(",");
}

export async function initializeExtensions(
  pool: Pool,
  extensions: RuntimeDBExtension[],
) {
  if (extensions.length === 0) {
    return;
  }

  const res = await pool.query<{ extname: string; extversion: string }>(
    "SELECT extname, extversion FROM pg_extension",
  );
  const installed = new Map<string, InstalledDBExtension>();
  for (const row of res.rows) {
    installed.set(row.extname, {
      name: row.extname,
      version: row.extversion,
    });
  }

  for (const extension of normalizeExtensions(extensions)) {
    const current = installed.get(extension.name);
    if (!current) {
      throw new Error(
        `required db extension "${extension.name}" is not installed`,
      );
    }
    if (extension.version && extension.version !== current.version) {
      throw new Error(
        `required db extension "${extension.name}" version "${extension.version}" but found "${current.version}"`,
      );
    }

    const handler = runtimeHandlers.get(extension.name);
    await handler?.validate?.(current, extension);
    await handler?.initialize?.(pool, current, extension);
  }
}

function loadExtensionsState(statePath?: string): ExtensionsState | undefined {
  if (!statePath || !fs.existsSync(statePath)) {
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8")) as ExtensionsState;
  } catch (err) {
    throw new Error(`invalid extensions state file at ${statePath}`);
  }
}

function resolveStatePath(): string | undefined {
  const start = process.cwd();
  const root = findGitRoot(start) || start;
  const schemaDir = path.join(root, DEFAULT_SCHEMA_DIR);
  return path.join(schemaDir, STATE_DIR, STATE_FILE);
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
