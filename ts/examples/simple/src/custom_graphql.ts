import glob from "glob";
import { GQLCapture } from "ent/graphql";

GQLCapture.enable(true);
// TODO configurable paths...
// for now only ent/**/
// TODO we can probably be even smarter here but this is fine for now
// and then it'll be graphql/custom or something
const files = glob.sync("src/ent/**/*.ts", {
  ignore: ["**/generated/**"],
});
let promises: any[] = [];
files.forEach((file) => {
  promises.push(require(file));
});

Promise.all(promises).then(() => {
  let args = GQLCapture.getCustomArgs();
  let fields = GQLCapture.getCustomFields();
  GQLCapture.resolve(["User"]);
  console.log(
    JSON.stringify({
      args,
      fields,
    }),
  );
});
