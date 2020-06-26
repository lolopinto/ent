import glob from "glob";
import minimist from "minimist";
import { GQLCapture } from "../graphql";
import * as readline from "readline";
import * as path from "path";
//import * as tsconfigPaths from "tsconfig-paths";

GQLCapture.enable(true);

async function readInputs(): Promise<string[]> {
  return await new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      //  output: process.stdout,
      terminal: false,
    });
    let nodes: string[] = [];
    rl.on("line", function(line: string) {
      nodes.push(line);
    });

    rl.on("close", function() {
      return resolve(nodes);
    });
  });
}

async function main() {
  const options = minimist(process.argv.slice(2));
  console.log(options);

  if (!options.path) {
    throw new Error("path required");
  }
  const nodes = await readInputs();

  // TODO configurable paths...
  // for now only ent/**/
  // TODO we can probably be even smarter here but this is fine for now
  // and then it'll be graphql/custom or something
  const entFiles = glob.sync(path.join(options.path, "/ent/**/*.ts"), {
    // no actions for now to speed things up
    ignore: ["**/generated/**", "**/tests/**", "**/actions/**"],
  });
  const graphqlFiles = glob.sync(path.join(options.path, "/graphql/**/*.ts"), {
    // no actions for now to speed things up
    ignore: ["**/generated/**", "**/tests/**", "**/actions/**"],
  });
  const files = [...entFiles, ...graphqlFiles];
  console.log(files);
  let promises: any[] = [];
  files.forEach((file) => {
    promises.push(require(file));
  });

  await Promise.all(promises);

  let args = GQLCapture.getCustomArgs();
  let fields = GQLCapture.getProcessedCustomFields();
  GQLCapture.resolve(nodes);
  console.log(
    JSON.stringify({
      args,
      fields,
    }),
  );
}

Promise.resolve(main());
