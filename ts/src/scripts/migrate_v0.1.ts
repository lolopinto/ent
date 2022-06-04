import { transform } from "../tsc/transform";
//import { TransformAction } from "../tsc/transform_action";
import { TransformSchema } from "../tsc/transform_schema";
//require("tsconfig-paths/register");

async function main() {
  transform(new TransformSchema());
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

// transform_schema first?
// move generated
// convert -> src/ent
// then actions
