import * as glob from "glob";
import * as path from "path";
import minimist from "minimist";
import { createRequire } from "node:module";
import { getCustomInfo } from "../tsc/ast.js";
import { GlobalSchema } from "../schema/schema.js";
import { toClassName } from "../names/names.js";

const nodeRequire = createRequire(import.meta.url);
const parseSchemaModule = import(
  new URL("../parse_schema/parse.js", import.meta.url).href,
).catch(() =>
  import(new URL("../parse_schema/parse.ts", import.meta.url).href),
);

function main() {
  const options = minimist(process.argv.slice(2));

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
      globalSchema = nodeRequire(p).default;
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
    const s = nodeRequire(p).default;
    if (relativePath !== undefined) {
      s.schemaPath = relativePath;
    }
    potentialSchemas[toClassName(schema)] = s;
  }
  //  console.log(potentialSchemas);

  // NB: do not change this to async/await
  // doing so runs it buffer limit on linux (65536 bytes) and we lose data reading in go
  parseSchemaModule
    .then(({ parseSchema }) => parseSchema(potentialSchemas, globalSchema))
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
