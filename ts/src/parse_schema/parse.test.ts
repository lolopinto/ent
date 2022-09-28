import { FieldMap, Schema } from "src/schema";
import { StringType } from "../schema/field";
import { BaseEntSchema, EntSchema } from "../schema/base_schema";
import { parseSchema } from "./parse";

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
