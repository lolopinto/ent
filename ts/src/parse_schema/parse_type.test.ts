import { DBType, FieldMap } from "../schema/schema";
import { BaseEntSchema } from "../schema/base_schema";
import { parseSchema } from "./parse";
import { JSONBType, JSONBListType } from "../schema/json_field";

test("importType", async () => {
  class Bar extends BaseEntSchema {
    fields: FieldMap = {
      foo: JSONBType({
        importType: {
          path: "path",
          type: "Foo",
        },
      }),
    };
  }
  const r = parseSchema({ bar: Bar });
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
  class Bar extends BaseEntSchema {
    fields: FieldMap = {
      foo: JSONBListType({
        importType: {
          path: "path",
          type: "Foo",
        },
      }),
    };
  }
  const r = parseSchema({ bar: Bar });
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
