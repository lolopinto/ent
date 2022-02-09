import { FieldMap, Schema } from "src/schema";
import { StringType } from "../schema/field";
import { BaseEntSchema } from "../schema/base_schema";
import { parseSchema } from "./parse";

test("legacy class", async () => {
  class Foo extends BaseEntSchema {
    fields: FieldMap = {
      name: StringType(),
    };
  }

  parseSchema({ foo: Foo });
});

test("implicit schema", async () => {
  const Foo: Schema = {
    fields: {
      name: StringType(),
    },
  };

  parseSchema({ foo: Foo });
});

test("new API with constructor config", async () => {
  const Foo = new BaseEntSchema({
    fields: {
      name: StringType(),
    },
  });

  parseSchema({ foo: Foo });
});
