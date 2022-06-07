import { transform } from "../tsc/transform";
import { TransformSchema } from "../tsc/transform_schema";
import { TransformEnt } from "../tsc/transform_ent";
import { moveGenerated } from "../tsc/move_generated";
import { TransformAction } from "../tsc/transform_action";
import minimist from "minimist";

// call from docker
// since clients [sh/w]ouldn't have ts-node...

// locally
// ts-node --swc --project ./tsconfig.json -r tsconfig-paths/register ../../../ts/src/scripts/migrate_v0.1.ts
async function main() {
  const options = minimist(process.argv.slice(2));

  // install 0.1.x dependencies
  // maybe provide options to make this easier if someone wants to do this in steps to see what's happening
  if (options.move_generated) {
    moveGenerated();
  }
  // codegen  write-all --disable-custom-graphql
  if (options.transform_schema) {
    transform(new TransformSchema());
  }
  // codegen write-all --disable-custom-graphql
  if (options.transform_ent) {
    transform(new TransformEnt());
  }
  if (options.transform_action) {
    transform(new TransformAction());
  }
  // codegen write-all
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
