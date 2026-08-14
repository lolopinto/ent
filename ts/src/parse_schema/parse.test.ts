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

test("global schema db extensions normalized", async () => {
  const Foo: Schema = {
    fields: {
      name: StringType(),
    },
  };

  const parsed = await parseSchema(
    { foo: Foo },
    {
      dbExtensions: [
        {
          name: "postgis",
          runtimeSchemas: ["public"],
        },
        {
          name: "vector",
          provisionedBy: "external",
          dropCascade: true,
        },
      ],
    },
  );

  expect(parsed.globalSchema?.dbExtensions).toEqual([
    {
      name: "postgis",
      provisionedBy: "ent",
      runtimeSchemas: ["public"],
      dropCascade: false,
    },
    {
      name: "vector",
      provisionedBy: "external",
      runtimeSchemas: [],
      dropCascade: true,
    },
  ]);
});
