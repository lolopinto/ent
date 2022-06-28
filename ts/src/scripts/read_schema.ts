import glob from "glob";
import * as path from "path";
import { pascalCase } from "pascal-case";
import minimist from "minimist";
import { exit } from "process";
import { parseSchema } from "../parse_schema/parse";

function main() {
  const options = minimist(process.argv.slice(2));

  if (!options.path) {
    throw new Error("path required");
  }

  const r = /(\w+).ts/;
  const paths = glob.sync(path.join(options.path, "*.ts"), {
    ignore: [`\d+_read_schema.ts`],
  });
  let potentialSchemas = {};
  for (const p of paths) {
    const basename = path.basename(p);
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
    const s = require(p).default;
    if (relativePath !== undefined) {
      s.schemaPath = relativePath;
    }
    potentialSchemas[pascalCase(schema)] = s;
  }
  //  console.log(potentialSchemas);

  const result = parseSchema(potentialSchemas);

  console.log(JSON.stringify(result));
}

try {
  main();
} catch (err) {
  console.error(err);
  exit(1);
}
