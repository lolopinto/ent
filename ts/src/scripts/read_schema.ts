import * as glob from "glob";
import * as path from "path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./parse_args.js";
import { getCustomInfo } from "../tsc/ast.js";
import { GlobalSchema } from "../schema/schema.js";
import { toClassName } from "../names/names.js";
import { writeJSONToStdout } from "./stdout.js";

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.path) {
    throw new Error("path required");
  }

  const customInfo = getCustomInfo();
  const globalSchemaPath = customInfo.globalSchemaPath || "__global__schema.ts";

  let globalSchema: GlobalSchema | undefined;
  const r = /(\w+).ts/;
  // do we still even need this...
  const paths = glob.sync(path.join(options.path, "*.ts"), {
    ignore: [`\d+_read_schema.ts`],
  });
  let potentialSchemas = {};
  for (const p of paths) {
    const basename = path.basename(p);
    if (basename === globalSchemaPath) {
      globalSchema = await loadDefaultExport<GlobalSchema>(p);
      continue;
    }

    const match = r.exec(basename);
    if (!match) {
      throw new Error(`non-typescript file ${p} returned by glob`);
    }
    let schema = match[1];
    // convert foo_schema.ts -> foo
    if (schema.endsWith("_schema")) {
      schema = schema.slice(0, -7);
    }
    let relativePath: string | undefined;
    const index = p.indexOf("src/schema");
    if (index !== -1) {
      relativePath = p.substring(index);
    }
    const s = await loadDefaultExport<any>(p);
    if (relativePath !== undefined) {
      s.schemaPath = relativePath;
    }
    potentialSchemas[toClassName(schema)] = s;
  }
  //  console.log(potentialSchemas);

  const parseSchema = await loadParseSchema(options.path);
  const result = await parseSchema(potentialSchemas, globalSchema);
  await writeJSONToStdout(result);
}

async function loadParseSchema(schemaPath: string) {
  if (
    process.env.ENT_MODULE_FORMAT === "commonjs" &&
    process.env.ENT_RUNTIME !== "bun" &&
    !(process.versions as any).bun
  ) {
    // tsx keeps separate ESM-import and CommonJS-require module graphs. Parse
    // through the application's require context so CommonJS schema instances
    // and global-schema state use the same Ent graph.
    const appRequire = createRequire(
      path.join(path.resolve(schemaPath), "__ent_schema_resolver.cjs"),
    );
    return appRequire("@snowtop/ent/parse_schema/parse.js")
      .parseSchema as typeof import("../parse_schema/parse.js").parseSchema;
  }
  return (await import("../parse_schema/parse.js")).parseSchema;
}

async function loadDefaultExport<T>(file: string): Promise<T> {
  const loaded = await import(pathToFileURL(file).href);
  const value = loaded.default;
  // TypeScript compiled as CommonJS exposes its default export one level below
  // the namespace default returned by import(). Native ESM does not.
  if (
    value &&
    typeof value === "object" &&
    "__esModule" in value &&
    "default" in value
  ) {
    return value.default as T;
  }
  return value as T;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
