import { transform } from "../tsc/transform";
import { TransformSchema } from "../tsc/transform_schema";
import { TransformEnt } from "../tsc/transform_ent";
import { moveGenerated } from "../tsc/move_generated";

async function main() {
  // maybe provide options to make this easier if someone wants to do this in steps to see what's happening
  // transform(new TransformSchema());
  // transform(new TransformEnt());

  moveGenerated();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

// what's the order of sequence here in terms of what need to change?

// action may need to be last...

// npm install to latest
// codegen
// move generated
// then transform schema, ent, action

// transform_schema first?
// move generated
// convert -> src/ent
// then actions
