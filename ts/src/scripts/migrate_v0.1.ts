import { transform } from "../tsc/transform";
import { TransformSchema } from "../tsc/transform_schema";
import { TransformEnt } from "../tsc/transform_ent";
import { moveGenerated } from "../tsc/move_generated";
import { TransformAction } from "../tsc/transform_action";
import minimist from "minimist";
import { getCustomInfo } from "../tsc/ast";

// todo-sqlite
//  ts-node-script --swc --project ./tsconfig.json -r tsconfig-paths/register ../../ts/src/scripts/migrate_v0.1.ts --transform_schema --old_base_class BaseTodoSchema --new_schema_class TodoSchema  --transform_path src/schema/patterns/base
function main() {
  const customInfo = getCustomInfo();
  const options = minimist(process.argv.slice(2));

  // install 0.1.x dependencies
  // maybe provide options to make this easier if someone wants to do this in steps to see what's happening
  if (options.move_generated) {
    moveGenerated(customInfo.relativeImports!!);
  }
  // codegen  write-all --disable-custom-graphql
  if (options.transform_schema) {
    transform(
      new TransformSchema(
        customInfo.relativeImports!!,
        options.old_base_class,
        options.new_schema_class,
        options.transform_path,
      ),
    );
  }
  // codegen write-all --disable-custom-graphql
  if (options.transform_ent) {
    transform(new TransformEnt());
  }
  if (options.transform_action) {
    transform(new TransformAction(customInfo));
  }
  // codegen write-all
}

main();
