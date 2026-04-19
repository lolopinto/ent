import { types as pgTypes } from "pg";
import type { PostgresDriver, RuntimeDBExtension } from "./config";
import type { ResolvedDevSchema } from "./dev_schema";

const TEXT_ARRAY_OID = 1009;

export interface InstalledDBExtension {
  name: string;
  version: string;
  installSchema?: string;
}

export interface ExtensionTypeParser {
  name: string;
  parse(value: string | null): unknown;
}

export interface ExtensionRuntimeHandler {
  name: string;
  runtimeSchemas?: string[];
  types?: ExtensionTypeParser[];
  validate?(
    installed: InstalledDBExtension,
    extension: RuntimeDBExtension,
  ): void | Promise<void>;
}

const runtimeHandlers = new Map<string, ExtensionRuntimeHandler>();
const registeredTypeOIDs = new Set<number>();

interface Queryable {
  query<R extends Record<string, any> = any>(
    query: string,
    values?: any[],
  ): Promise<{ rows: R[] }>;
}

function normalizeProvisionedBy(
  extension: RuntimeDBExtension,
): "ent" | "external" {
  if (
    extension.provisionedBy === "ent" ||
    extension.provisionedBy === "external"
  ) {
    return extension.provisionedBy;
  }
  if (extension.provisionedBy) {
    throw new Error(
      `invalid provisionedBy ${extension.provisionedBy} for db extension ${extension.name}`,
    );
  }
  return "ent";
}

function normalizeRuntimeHandler(
  handler: ExtensionRuntimeHandler,
): ExtensionRuntimeHandler {
  const typeHandlers = new Map<string, ExtensionTypeParser>();
  for (const typeHandler of handler.types || []) {
    typeHandlers.set(typeHandler.name, typeHandler);
  }
  return {
    ...handler,
    runtimeSchemas: [...new Set(handler.runtimeSchemas || [])],
    types: [...typeHandlers.values()],
  };
}

function mergeRuntimeHandlers(
  lhs: ExtensionRuntimeHandler,
  rhs: ExtensionRuntimeHandler,
): ExtensionRuntimeHandler {
  const mergedTypes = new Map<string, ExtensionTypeParser>();
  for (const typeHandler of lhs.types || []) {
    mergedTypes.set(typeHandler.name, typeHandler);
  }
  for (const typeHandler of rhs.types || []) {
    mergedTypes.set(typeHandler.name, typeHandler);
  }
  return {
    name: rhs.name,
    runtimeSchemas: [
      ...new Set([
        ...(lhs.runtimeSchemas || []),
        ...(rhs.runtimeSchemas || []),
      ]),
    ],
    types: [...mergedTypes.values()],
    validate: rhs.validate || lhs.validate,
  };
}

function getRegisteredRuntimeHandlers(): ExtensionRuntimeHandler[] {
  return [...runtimeHandlers.values()].sort((lhs, rhs) =>
    lhs.name.localeCompare(rhs.name),
  );
}

export function registerExtensionRuntime(handler: ExtensionRuntimeHandler) {
  const normalized = normalizeRuntimeHandler(handler);
  const existing = runtimeHandlers.get(normalized.name);
  runtimeHandlers.set(
    normalized.name,
    existing ? mergeRuntimeHandlers(existing, normalized) : normalized,
  );
}

export function clearExtensionRuntimes() {
  runtimeHandlers.clear();
  registeredTypeOIDs.clear();
}

export function normalizeExtensions(
  extensions: RuntimeDBExtension[],
): RuntimeDBExtension[] {
  return [...extensions]
    .map((extension) => ({
      ...extension,
      provisionedBy: normalizeProvisionedBy(extension),
      runtimeSchemas: extension.runtimeSchemas || [],
      dropCascade: extension.dropCascade === true,
    }))
    .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
}

export function resolveExtensions(
  cfg?: RuntimeDBExtension[],
): RuntimeDBExtension[] {
  return normalizeExtensions(cfg || []);
}

export function getExtensionSearchPathSchemas(
  extensions: RuntimeDBExtension[],
): string[] {
  const normalizedExtensions = normalizeExtensions(extensions);
  const configuredExtensions = new Map(
    normalizedExtensions.map((extension) => [extension.name, extension]),
  );

  const seen = new Set<string>();
  const schemas: string[] = [];

  function addSchemas(runtimeSchemas: string[]) {
    for (const schema of runtimeSchemas) {
      if (!schema || seen.has(schema)) {
        continue;
      }
      seen.add(schema);
      schemas.push(schema);
    }
  }

  for (const extension of normalizedExtensions) {
    addSchemas(extension.runtimeSchemas || []);
  }

  for (const handler of getRegisteredRuntimeHandlers()) {
    const configured = configuredExtensions.get(handler.name);
    addSchemas(
      configured
        ? configured.runtimeSchemas || []
        : handler.runtimeSchemas || [],
    );
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

async function getInstalledExtensions(
  pool: Queryable,
  extensions: RuntimeDBExtension[],
): Promise<Map<string, InstalledDBExtension>> {
  if (extensions.length === 0) {
    return new Map();
  }

  const res = await pool.query<{
    extname: string;
    extversion: string;
    install_schema: string;
  }>(
    `
      SELECT
        extname,
        extversion,
        extnamespace::regnamespace::text AS install_schema
      FROM pg_extension
      WHERE extname = ANY($1::text[])
    `,
    [extensions.map((extension) => extension.name)],
  );

  const installed = new Map<string, InstalledDBExtension>();
  for (const row of res.rows) {
    installed.set(row.extname, {
      name: row.extname,
      version: row.extversion,
      installSchema: row.install_schema,
    });
  }
  return installed;
}

function registerArrayParser(
  arrayOID: number,
  parse: (value: string | null) => unknown,
) {
  if (!arrayOID || registeredTypeOIDs.has(arrayOID)) {
    return;
  }
  const parseTextArray = pgTypes.getTypeParser(TEXT_ARRAY_OID as any);
  pgTypes.setTypeParser(arrayOID as any, (value: string | null) => {
    if (value === null) {
      return null;
    }
    const parsed = parseTextArray(value) as Array<string | null>;
    return parsed.map((entry) => parse(entry));
  });
  registeredTypeOIDs.add(arrayOID);
}

async function initializeRegisteredTypeParsers(
  pool: Queryable,
  configuredExtensions: Map<string, RuntimeDBExtension>,
) {
  const registeredTypes = new Map<
    string,
    { extensionName: string; parse: (value: string | null) => unknown }
  >();

  for (const handler of getRegisteredRuntimeHandlers()) {
    for (const typeHandler of handler.types || []) {
      registeredTypes.set(typeHandler.name, {
        extensionName: handler.name,
        parse: typeHandler.parse,
      });
    }
  }

  if (registeredTypes.size === 0) {
    return;
  }

  const res = await pool.query<{
    oid: number;
    typname: string;
    typarray: number;
  }>(
    `
      SELECT oid, typname, typarray
      FROM pg_type
      WHERE typname = ANY($1::text[])
    `,
    [[...registeredTypes.keys()]],
  );

  const rowsByType = new Map(
    res.rows.map((row) => [row.typname, row] as const),
  );

  for (const [typeName, typeHandler] of registeredTypes.entries()) {
    const row = rowsByType.get(typeName);
    if (!row) {
      if (configuredExtensions.has(typeHandler.extensionName)) {
        throw new Error(
          `required pg type "${typeName}" for db extension "${typeHandler.extensionName}" was not found`,
        );
      }
      continue;
    }

    if (!registeredTypeOIDs.has(row.oid)) {
      pgTypes.setTypeParser(row.oid as any, typeHandler.parse);
      registeredTypeOIDs.add(row.oid);
    }
    registerArrayParser(row.typarray, typeHandler.parse);
  }
}

export async function initializeExtensions(
  pool: Queryable,
  extensions: RuntimeDBExtension[],
  postgresDriver: PostgresDriver = "pg",
) {
  const normalizedExtensions = normalizeExtensions(extensions);
  const configuredExtensions = new Map(
    normalizedExtensions.map((extension) => [extension.name, extension]),
  );

  const installedExtensions = await getInstalledExtensions(
    pool,
    normalizedExtensions,
  );

  for (const extension of normalizedExtensions) {
    const installed = installedExtensions.get(extension.name);
    if (!installed) {
      throw new Error(
        `required db extension "${extension.name}" is not installed`,
      );
    }
    if (extension.version && extension.version !== installed.version) {
      throw new Error(
        `required db extension "${extension.name}" version "${extension.version}" but found "${installed.version}"`,
      );
    }
    if (
      extension.installSchema &&
      extension.installSchema !== installed.installSchema
    ) {
      throw new Error(
        `required db extension "${extension.name}" install schema "${extension.installSchema}" but found "${installed.installSchema}"`,
      );
    }

    const handler = runtimeHandlers.get(extension.name);
    await handler?.validate?.(installed, extension);
  }

  if (postgresDriver === "bun") {
    const unsupportedExtensions = normalizedExtensions
      .filter((extension) => (runtimeHandlers.get(extension.name)?.types || []).length > 0)
      .map((extension) => extension.name);
    if (unsupportedExtensions.length > 0) {
      throw new Error(
        `postgresDriver "bun" does not support extension runtime type parsers for: ${unsupportedExtensions.join(
          ", ",
        )}`,
      );
    }
    return;
  }

  await initializeRegisteredTypeParsers(pool, configuredExtensions);
}
