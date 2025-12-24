import { FieldMap, Schema } from "../schema/index.js";
import { StringType } from "../schema/field.js";
import { BaseEntSchema, EntSchema } from "../schema/base_schema.js";
import { parseSchema } from "./parse.js";

test("legacy class", async () => {
  class Foo extends BaseEntSchema {
    fields: FieldMap = {
      name: StringType(),
    };
  }

  await parseSchema({ foo: Foo });
});

test("implicit schema", async () => {
  const Foo: Schema = {
    fields: {
      name: StringType(),
    },
  };

  await parseSchema({ foo: Foo });
});

test("new API with constructor config", async () => {
  const Foo = new EntSchema({
    fields: {
      name: StringType(),
    },
  });

  await parseSchema({ foo: Foo });
});
