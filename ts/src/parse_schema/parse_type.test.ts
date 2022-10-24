import { DBType } from "../schema/schema";
import { EntSchema } from "../schema/base_schema";
import { parseSchema } from "./parse";
import { JSONBType, JSONBListType } from "../schema/json_field";

test("importType", async () => {
  const Bar = new EntSchema({
    fields: {
      foo: JSONBType({
        importType: {
          path: "path",
          type: "Foo",
        },
      }),
    },
  });
  const r = await parseSchema({ bar: Bar });
  const fields = r.schemas.bar.fields;
  expect(fields.length).toBe(4);
  const jsonField = fields[3];
  expect(jsonField.type).toStrictEqual({
    dbType: DBType.JSONB,
    importType: {
      path: "path",
      type: "Foo",
      importPath: "path",
      import: "Foo",
    },
  });
});

test("importType list", async () => {
  const Bar = new EntSchema({
    fields: {
      foo: JSONBListType({
        importType: {
          path: "path",
          type: "Foo",
        },
      }),
    },
  });
  const r = await parseSchema({ bar: Bar });
  const fields = r.schemas.bar.fields;
  expect(fields.length).toBe(4);
  const jsonField = fields[3];
  expect(jsonField.type).toStrictEqual({
    dbType: DBType.List,
    listElemType: {
      dbType: DBType.JSONB,
      importType: {
        path: "path",
        type: "Foo",
        importPath: "path",
        import: "Foo",
      },
    },
  });
});
