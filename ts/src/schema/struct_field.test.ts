import { v1 } from "uuid";
import {
  EnumType,
  FieldMap,
  FloatType,
  IntegerListType,
  StringListType,
} from "./index.js";
import {
  UUIDType,
  IntegerType,
  StringType,
  BooleanType,
  TimestampType,
  DateType,
} from "./field.js";
import { StructOptions, StructType, StructTypeAsList } from "./struct_field.js";
import { clearGlobalSchema, setGlobalSchema } from "../core/global_schema.js";
import { MockLogs } from "../testutils/mock_log.js";
import { clearLogLevels, setLogLevels } from "../core/logger.js";

function structTypeF(fields: FieldMap) {
  return StructType({
    tsType: "Foo",
    fields,
  });
}
function structListTypeF(fields: FieldMap, opts?: Partial<StructOptions>) {
  return StructTypeAsList({
    tsType: "Foo",
    fields,
    ...opts,
  });
}

test("scalars", async () => {
  const f = structTypeF({
    uuid: UUIDType(),
    int: IntegerType(),
    string: StringType(),
    bool: BooleanType(),
    ts: TimestampType(),
    float: FloatType(),
    enum: EnumType({ values: ["yes", "no", "maybe"] }),
  });

  const d = new Date();
  const val = {
    uuid: v1(),
    int: 2,
    string: "string",
    bool: false,
    ts: d,
    float: 1.0,
    enum: "yes",
  };
  const formatted = {
    ...val,
    ts: d.toISOString(),
  };
  expect(await f.valid(val)).toBe(true);
  expect(f.format(val)).toBe(JSON.stringify(formatted));
});

test("missing field", async () => {
  const f = structTypeF({
    uuid: UUIDType(),
    int: IntegerType(),
    string: StringType(),
    bool: BooleanType(),
    ts: TimestampType(),
    float: FloatType(),
    enum: EnumType({ values: ["yes", "no", "maybe"] }),
  });

  const d = new Date();
  const val = {
    uuid: v1(),
    int: 2,
    string: "string",
    bool: false,
    ts: d,
    float: 1.0,
  };
  expect(await f.valid(val)).toBe(false);
});

test("null when non-nullable", async () => {
  const f = structTypeF({
    uuid: UUIDType(),
    int: IntegerType(),
    string: StringType(),
    bool: BooleanType(),
    ts: TimestampType(),
    float: FloatType(),
    enum: EnumType({ values: ["yes", "no", "maybe"] }),
  });

  const d = new Date();
  const val = {
    uuid: v1(),
    int: 2,
    string: "string",
    bool: false,
    ts: d,
    float: 1.0,
    enum: null,
  };
  expect(await f.valid(val)).toBe(false);
});

test("nullable field set to null", async () => {
  const f = structTypeF({
    uuid: UUIDType(),
    int: IntegerType(),
    string: StringType(),
    bool: BooleanType(),
    ts: TimestampType(),
    float: FloatType(),
    enum: EnumType({ values: ["yes", "no", "maybe"], nullable: true }),
  });

  const d = new Date();
  const val = {
    uuid: v1(),
    int: 2,
    string: "string",
    bool: false,
    ts: d,
    float: 1.0,
    enum: null,
  };
  expect(await f.valid(val)).toBe(true);
  const formatted = {
    ...val,
    ts: d.toISOString(),
  };
  expect(f.format(val)).toBe(JSON.stringify(formatted));
});

// TODO should we support this or only allow null?
test("nullable field left out", async () => {
  const f = structTypeF({
    uuid: UUIDType(),
    int: IntegerType(),
    string: StringType(),
    bool: BooleanType(),
    ts: TimestampType(),
    float: FloatType(),
    enum: EnumType({ values: ["yes", "no", "maybe"], nullable: true }),
  });

  const d = new Date();
  const val = {
    uuid: v1(),
    int: 2,
    string: "string",
    bool: false,
    ts: d,
    float: 1.0,
  };
  expect(await f.valid(val)).toBe(true);
  const formatted = {
    ...val,
    ts: d.toISOString(),
  };
  expect(f.format(val)).toBe(JSON.stringify(formatted));
});

test("list fields", async () => {
  const f = structTypeF({
    string_list: StringListType(),
    int_list: IntegerListType(),
  });

  const val = {
    string_list: ["1", "2", "3"],
    int_list: [1, 2, 3],
  };
  expect(await f.valid(val)).toBe(true);
  expect(f.format(val)).toBe(JSON.stringify(val));
});

test("formatted list fields", async () => {
  const f = structTypeF({
    string_list: StringListType({ toUpperCase: true }),
    int_list: IntegerListType(),
  });

  const val = {
    string_list: ["a", "b", "c"],
    int_list: [1, 2, 3],
  };
  const expected = {
    string_list: ["A", "B", "C"],
    int_list: [1, 2, 3],
  };
  expect(await f.valid(val)).toBe(true);
  expect(f.format(val)).toBe(JSON.stringify(expected));
});

test("struct with nested date field", async () => {
  const nested = StructType({
    tsType: "HolidayDate",
    fields: {
      date: DateType(),
    },
  });
  const f = structTypeF({
    data: nested,
  });

  const val = {
    data: {
      date: new Date(Date.UTC(2021, 0, 20)),
    },
  };

  expect(await f.valid(val)).toBe(true);
  expect(f.format(val)).toBe(
    JSON.stringify({
      data: {
        date: "2021-01-20",
      },
    }),
  );
});

test("struct", async () => {
  const f = structTypeF({
    obj: structTypeF({
      uuid: UUIDType(),
      int: IntegerType(),
      string: StringType(),
      bool: BooleanType(),
      float: FloatType(),
      enum: EnumType({ values: ["yes", "no", "maybe"] }),
      string_list: StringListType(),
      int_list: IntegerListType(),
    }),
  });
  const val = {
    obj: {
      uuid: v1(),
      int: 2,
      string: "string",
      bool: false,
      float: 1.0,
      enum: "yes",
      string_list: ["1", "2", "3"],
      int_list: [1, 2, 3],
    },
  };
  expect(await f.valid(val)).toBe(true);
  expect(f.format(val)).toBe(JSON.stringify(val));
});

test("super nested", async () => {
  const f = structTypeF({
    uuid: UUIDType(),
    int: IntegerType(),
    string: StringType(),
    bool: BooleanType(),
    float: FloatType(),
    enum: EnumType({ values: ["yes", "no", "maybe"] }),
    string_list: StringListType(),
    int_list: IntegerListType(),
    obj: structTypeF({
      nested_uuid: UUIDType(),
      nested_int: IntegerType(),
      nested_string: StringType(),
      nested_bool: BooleanType(),
      nested_float: FloatType(),
      nested_enum: EnumType({ values: ["yes", "no", "maybe"] }),
      nested_string_list: StringListType(),
      nested_int_list: IntegerListType(),
      nested_obj: structTypeF({
        nested_nested_uuid: UUIDType(),
        nested_nested_int: IntegerType(),
        nested_nested_string: StringType(),
        nested_nested_bool: BooleanType(),
        nested_nested_float: FloatType(),
        nested_nested_enum: EnumType({ values: ["yes", "no", "maybe"] }),
        nested_nested_string_list: StringListType(),
        nested_nested_int_list: IntegerListType(),
      }),
    }),
  });

  const val = {
    uuid: v1(),
    int: 2,
    string: "string",
    bool: false,
    float: 1.0,
    enum: "yes",
    string_list: ["1", "2", "3"],
    int_list: [1, 2, 3],
    obj: {
      nested_uuid: v1(),
      nested_int: 2,
      nested_string: "string",
      nested_bool: false,
      nested_float: 1.0,
      nested_enum: "yes",
      nested_string_list: ["1", "2", "3"],
      nested_int_list: [1, 2, 3],
      nested_obj: {
        nested_nested_uuid: v1(),
        nested_nested_int: 2,
        nested_nested_string: "string",
        nested_nested_bool: false,
        nested_nested_float: 1.0,
        nested_nested_enum: "yes",
        nested_nested_string_list: ["1", "2", "3"],
        nested_nested_int_list: [1, 2, 3],
      },
    },
  };
  expect(await f.valid(val)).toBe(true);
  expect(f.format(val)).toBe(JSON.stringify(val));
});

describe("struct as list", () => {
  const f = structListTypeF({
    uuid: UUIDType(),
    int: IntegerType(),
    string: StringType(),
    bool: BooleanType(),
    ts: TimestampType(),
    float: FloatType(),
    enum: EnumType({ values: ["yes", "no", "maybe"] }),
  });
  const f2 = structListTypeF(
    {
      uuidUnique: UUIDType(),
      int: IntegerType(),
      string: StringType(),
      bool: BooleanType(),
      ts: TimestampType(),
      float: FloatType(),
      enum: EnumType({ values: ["yes", "no", "maybe"] }),
    },
    {
      validateUniqueKey: "uuidUnique",
    },
  );

  test("valid", async () => {
    const d = new Date();
    const d2 = new Date();
    const val = {
      uuid: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };
    const val2 = {
      uuid: v1(),
      int: 3,
      string: "string",
      bool: true,
      ts: d2,
      float: 2.0,
      enum: "yes",
    };
    const formatted1 = {
      ...val,
      ts: d.toISOString(),
    };
    const formatted2 = {
      ...val2,
      ts: d2.toISOString(),
    };
    const data = [val, val2];
    const format = [formatted1, formatted2];
    expect(await f.valid(data)).toBe(true);
    expect(f.format(data)).toBe(JSON.stringify(format));
  });

  test("valid unique key camel case", async () => {
    const d = new Date();
    const d2 = new Date();
    const val = {
      uuidUnique: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };
    const val2 = {
      uuidUnique: v1(),
      int: 3,
      string: "string",
      bool: true,
      ts: d2,
      float: 2.0,
      enum: "yes",
    };
    const formatted1 = {
      uuid_unique: val.uuidUnique,
      ...val,
      ts: d.toISOString(),
    };
    // @ts-expect-error
    delete formatted1["uuidUnique"];
    const formatted2 = {
      uuid_unique: val2.uuidUnique,
      ...val2,
      ts: d2.toISOString(),
    };
    // @ts-expect-error
    delete formatted2["uuidUnique"];

    const data = [val, val2];
    const format = [formatted1, formatted2];
    expect(await f2.valid(data)).toBe(true);
    expect(f2.format(data)).toBe(JSON.stringify(format));
  });

  test("valid unique key snake case", async () => {
    const d = new Date();
    const d2 = new Date();
    const val = {
      uuid_unique: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };
    const val2 = {
      uuid_unique: v1(),
      int: 3,
      string: "string",
      bool: true,
      ts: d2,
      float: 2.0,
      enum: "yes",
    };
    const formatted1 = {
      ...val,
      ts: d.toISOString(),
    };
    const formatted2 = {
      ...val2,
      ts: d2.toISOString(),
    };
    const data = [val, val2];
    const format = [formatted1, formatted2];
    expect(await f2.valid(data)).toBe(true);
    expect(f2.format(data)).toBe(JSON.stringify(format));
  });

  test("invalid unique key", async () => {
    const d = new Date();
    const d2 = new Date();
    const val = {
      uuidUnique: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };
    const val2 = {
      uuidUnique: val.uuidUnique,
      int: 3,
      string: "string",
      bool: true,
      ts: d2,
      float: 2.0,
      enum: "yes",
    };
    const data = [val, val2];
    expect(await f2.valid(data)).toBe(false);
  });

  test("invalid unique key. storage_case", async () => {
    const d = new Date();
    const d2 = new Date();
    const val = {
      uuid_unique: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };
    const val2 = {
      uuid_unique: val.uuid_unique,
      int: 3,
      string: "string",
      bool: true,
      ts: d2,
      float: 2.0,
      enum: "yes",
    };
    const data = [val, val2];
    expect(await f2.valid(data)).toBe(false);
  });

  test("invalid not list", async () => {
    const d = new Date();
    const val = {
      uuid: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };

    expect(await f.valid(val)).toBe(false);
  });

  test("invalid item in list", async () => {
    const d = new Date();
    const val = {
      uuid: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };
    const val2 = {
      uuid: v1(),
      int: 3,
      string: "string",
      bool: true,
      float: 2.0,
      enum: "yes",
    };

    const data = [val, val2];
    expect(await f.valid(data)).toBe(false);
  });
});

describe("global type", () => {
  beforeAll(() => {
    setGlobalSchema({
      fields: {
        foo: structTypeF({
          uuid: UUIDType(),
          int: IntegerType(),
          string: StringType(),
          bool: BooleanType(),
          ts: TimestampType(),
          float: FloatType(),
          enum: EnumType({ values: ["yes", "no", "maybe"] }),
        }),
      },
    });
  });

  afterAll(() => {
    clearGlobalSchema();
  });

  test("valid", async () => {
    const f = StructType({
      globalType: "Foo",
    });

    const d = new Date();
    const val = {
      uuid: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };
    const valid = await f.valid(val);
    expect(valid).toBe(true);
    const formatted = {
      ...val,
      ts: d.toISOString(),
    };
    expect(f.format(val)).toBe(JSON.stringify(formatted));
  });

  test("invalid", async () => {
    const f = StructType({
      globalType: "Foo",
    });

    const val = {
      uuid: v1(),
      int: 3,
      string: "string",
      bool: true,
      float: 2.0,
      enum: "yes",
    };
    const valid = await f.valid(val);
    expect(valid).toBe(false);
  });

  test("used in list", async () => {
    const f = StructTypeAsList({
      globalType: "Foo",
    });

    const d = new Date();
    const val = {
      uuid: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };
    const val2 = {
      uuid: v1(),
      int: 3,
      string: "string",
      bool: true,
      ts: d,
      float: 2.0,
      enum: "yes",
    };
    const formatted1 = {
      ...val,
      ts: d.toISOString(),
    };
    const formatted2 = {
      ...val2,
      ts: d.toISOString(),
    };
    const data = [val, val2];
    const format = [formatted1, formatted2];
    expect(await f.valid(data)).toBe(true);
    expect(f.format(data)).toBe(JSON.stringify(format));
  });
});

describe("no. global. trying to reference global", () => {
  const ml = new MockLogs();
  beforeEach(() => {
    ml.mock();
  });
  afterEach(() => {
    clearLogLevels();
    ml.clear();
  });

  test("invalid", async () => {
    const f = StructType({
      globalType: "Foo",
    });

    const val = {
      uuid: v1(),
      int: 3,
      string: "string",
      bool: true,
      float: 2.0,
      enum: "yes",
    };
    const valid = await f.valid(val);
    expect(valid).toBe(false);
    expect(ml.errors.length).toBe(0);
  });

  test("invalid but logged", async () => {
    setLogLevels("error");
    const f = StructType({
      globalType: "Foo",
    });

    const val = {
      uuid: v1(),
      int: 3,
      string: "string",
      bool: true,
      float: 2.0,
      enum: "yes",
    };
    const valid = await f.valid(val);
    expect(valid).toBe(false);
    expect(ml.errors).toStrictEqual([
      "globalType Foo not found in global schema",
    ]);
  });
});

// doesn't really make sense but let's test it
describe("nullable global type", () => {
  beforeAll(() => {
    setGlobalSchema({
      fields: {
        foo: StructType({
          fields: {
            uuid: UUIDType(),
            int: IntegerType(),
            string: StringType(),
            bool: BooleanType(),
            ts: TimestampType(),
            float: FloatType(),
            enum: EnumType({ values: ["yes", "no", "maybe"] }),
          },
          nullable: true,
          tsType: "Foo",
        }),
      },
    });
  });

  afterAll(() => {
    clearGlobalSchema();
  });

  test("valid", async () => {
    const f = StructType({
      globalType: "Foo",
    });

    const d = new Date();
    const val = {
      uuid: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };
    const valid = await f.valid(val);
    expect(valid).toBe(true);
    const formatted = {
      ...val,
      ts: d.toISOString(),
    };
    expect(f.format(val)).toBe(JSON.stringify(formatted));
  });

  test("invalid", async () => {
    const f = StructType({
      globalType: "Foo",
    });

    const val = {
      uuid: v1(),
      int: 3,
      string: "string",
      bool: true,
      float: 2.0,
      enum: "yes",
    };
    const valid = await f.valid(val);
    expect(valid).toBe(false);
  });
});

describe("struct as list global type", () => {
  beforeAll(() => {
    setGlobalSchema({
      fields: {
        foo: structListTypeF({
          uuid: UUIDType(),
          int: IntegerType(),
          string: StringType(),
          bool: BooleanType(),
          ts: TimestampType(),
          float: FloatType(),
          enum: EnumType({ values: ["yes", "no", "maybe"] }),
        }),
      },
    });
  });

  afterAll(() => {
    clearGlobalSchema();
  });

  const f = StructTypeAsList({
    globalType: "Foo",
  });

  test("valid", async () => {
    const d = new Date();
    const d2 = new Date();
    const val = {
      uuid: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };
    const val2 = {
      uuid: v1(),
      int: 3,
      string: "string",
      bool: true,
      ts: d2,
      float: 2.0,
      enum: "yes",
    };
    const formatted1 = {
      ...val,
      ts: d.toISOString(),
    };
    const formatted2 = {
      ...val2,
      ts: d2.toISOString(),
    };
    const data = [val, val2];
    const format = [formatted1, formatted2];
    expect(await f.valid(data)).toBe(true);
    expect(f.format(data)).toBe(JSON.stringify(format));
  });

  test("invalid not list", async () => {
    const d = new Date();
    const val = {
      uuid: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };

    expect(await f.valid(val)).toBe(false);
  });

  test("invalid item in list", async () => {
    const d = new Date();
    const val = {
      uuid: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };
    const val2 = {
      uuid: v1(),
      int: 3,
      string: "string",
      bool: true,
      float: 2.0,
      enum: "yes",
    };

    const data = [val, val2];
    expect(await f.valid(data)).toBe(false);
  });

  test("used in struct", async () => {
    const f = StructType({
      globalType: "Foo",
    });
    const d = new Date();
    const val = {
      uuid: v1(),
      int: 2,
      string: "string",
      bool: false,
      ts: d,
      float: 1.0,
      enum: "yes",
    };
    const formatted = {
      ...val,
      ts: d.toISOString(),
    };
    expect(await f.valid(val)).toBe(true);
    expect(f.format(val)).toBe(JSON.stringify(formatted));
  });
});

test("struct with polymorphic field", async () => {
  const f = structTypeF({
    user_id: UUIDType({
      polymorphic: {
        types: ["User"],
      },
    }),
    value: StringType(),
  });

  const val = {
    user_id: v1(),
    user_type: "user",
    value: "string",
  };

  expect(await f.valid(val)).toBe(true);
  expect(f.format(val)).toBe(JSON.stringify(val));
});

test("struct with invalid polymorphic field", async () => {
  const f = structTypeF({
    user_id: UUIDType({
      polymorphic: {
        types: ["User"],
      },
    }),
    value: StringType(),
  });

  const val = {
    user_id: v1(),
    user_type: "hello",
    value: "string",
  };

  expect(await f.valid(val)).toBe(false);
});
