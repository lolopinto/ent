import { v1 } from "uuid";
import { EnumType, FloatType, IntegerListType, StringListType } from ".";
import {
  UUIDType,
  IntegerType,
  StringType,
  BooleanType,
  TimestampType,
} from "./field";
import { StructType } from "./struct_field";

test("scalars", async () => {
  const f = StructType({
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
  const f = StructType({
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
  const f = StructType({
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
  const f = StructType({
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
  const f = StructType({
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
  const f = StructType({
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
  const f = StructType({
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

test("struct", async () => {
  const f = StructType({
    obj: StructType({
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
  const f = StructType({
    uuid: UUIDType(),
    int: IntegerType(),
    string: StringType(),
    bool: BooleanType(),
    float: FloatType(),
    enum: EnumType({ values: ["yes", "no", "maybe"] }),
    string_list: StringListType(),
    int_list: IntegerListType(),
    obj: StructType({
      nested_uuid: UUIDType(),
      nested_int: IntegerType(),
      nested_string: StringType(),
      nested_bool: BooleanType(),
      nested_float: FloatType(),
      nested_enum: EnumType({ values: ["yes", "no", "maybe"] }),
      nested_string_list: StringListType(),
      nested_int_list: IntegerListType(),
      nested_obj: StructType({
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
