import glob from "glob";
import { GQLCapture } from "ent/graphql";
import * as readline from "readline";

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
  //  console.log(nodes);
  GQLCapture.enable(true);
  // TODO configurable paths...
  // for now only ent/**/
  // TODO we can probably be even smarter here but this is fine for now
  // and then it'll be graphql/custom or something
  const files = glob.sync("src/ent/**/*.ts", {
    ignore: ["**/generated/**", "**/tests/**"],
  });
  //  console.log(files);
  let promises: any[] = [];
  files.forEach((file) => {
    promises.push(require(file));
  });

  Promise.all(promises).then(() => {
    let args = GQLCapture.getCustomArgs();
    let fields = GQLCapture.getProcessedCustomFields();
    GQLCapture.resolve(nodes);
    console.log(
      JSON.stringify({
        args,
        fields,
      }),
    );
  });
});
