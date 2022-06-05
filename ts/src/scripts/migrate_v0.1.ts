import { transform } from "../tsc/transform";
import { TransformSchema } from "../tsc/transform_schema";
import { TransformEnt } from "../tsc/transform_ent";

async function main() {
  transform(new TransformSchema());
  transform(new TransformEnt());
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
