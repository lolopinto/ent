import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function createAppRequire(filePath: string) {
  return createRequire(path.join(path.resolve(filePath), "__ent_resolver.cjs"));
}

export function resolveGraphQLPath(
  filePath: string,
  modulePath: string,
  override = process.env.GRAPHQL_PATH,
): string | undefined {
  if (override) {
    return override;
  }

  try {
    return createAppRequire(filePath).resolve(modulePath);
  } catch {
    return undefined;
  }
}

interface LoadGraphQLModuleOptions {
  filePath: string;
  graphqlPath: string;
  explicitGraphQLPath: boolean;
  moduleFormat?: string;
  runtime: string;
  localScriptPath: boolean;
}

export async function loadGraphQLModule<T>({
  filePath,
  graphqlPath,
  explicitGraphQLPath,
  moduleFormat,
  runtime,
  localScriptPath,
}: LoadGraphQLModuleOptions): Promise<T> {
  if (moduleFormat === "commonjs" && runtime !== "bun") {
    return createAppRequire(filePath)(graphqlPath) as T;
  }

  if (!explicitGraphQLPath && (localScriptPath || runtime === "bun")) {
    return (await import("../graphql/graphql.js")) as T;
  }

  let importPath = graphqlPath;
  if (!importPath.startsWith("file:")) {
    // require.resolve handles package specifiers, files, and historical
    // GRAPHQL_PATH directory overrides. Converting its concrete file result
    // to a URL avoids unsupported ESM directory imports.
    importPath = createAppRequire(filePath).resolve(importPath);
    importPath = pathToFileURL(importPath).href;
  }
  return (await import(importPath)) as T;
}
