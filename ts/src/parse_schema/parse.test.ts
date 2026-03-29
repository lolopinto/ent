import { FieldMap, Schema } from "../schema";
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
          managed: false,
          dropCascade: true,
        },
      ],
    },
  );

  expect(parsed.globalSchema?.dbExtensions).toEqual([
    {
      name: "postgis",
      managed: true,
      runtimeSchemas: ["public"],
      dropCascade: false,
    },
    {
      name: "vector",
      managed: false,
      runtimeSchemas: [],
      dropCascade: true,
    },
  ]);
});
