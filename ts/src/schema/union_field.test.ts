import { UnionType } from "./union_field";
import { StructField, StructType } from "./struct_field";
import {
  UUIDType,
  IntegerType,
  StringType,
  BooleanType,
  TimestampType,
  FloatType,
  EnumType,
} from "./field";
import { v1 } from "uuid";
declare type StructMap = {
  [key: string]: StructField;
};

function unionTypeF(fields: StructMap) {
  return UnionType({
    tsType: "Foo",
    fields,
  });
}

describe("simple", () => {
  const d = new Date();

  const f = unionTypeF({
    foo: StructType({
      tsType: "Struct1",
      fields: {
        foo_uuid: UUIDType(),
        foo_int: IntegerType(),
        foo_string: StringType(),
        foo_bool: BooleanType(),
        foo_ts: TimestampType(),
      },
    }),
    bar: StructType({
      tsType: "Struct2",
      fields: {
        bar_uuid: UUIDType(),
        bar_int: IntegerType(),
        bar_string: StringType(),
        bar_bool: BooleanType(),
        bar_ts: TimestampType(),
        bar_float: FloatType(),
        bar_enum: EnumType({ values: ["yes", "no", "maybe"], nullable: true }),
      },
    }),
    baz: StructType({
      tsType: "Struct3",
      fields: {
        baz_uuid: UUIDType(),
        baz_int: IntegerType(),
        baz_string: StringType(),
        baz_bool: BooleanType(),
        baz_ts: TimestampType(),
      },
    }),
  });

  test("foo valid", async () => {
    const val = {
      foo_uuid: v1(),
      foo_int: 2,
      foo_string: "string",
      foo_bool: false,
      foo_ts: d,
    };
    const formatted = {
      ...val,
      foo_ts: d.toISOString(),
    };
    expect(await f.valid(val)).toBe(true);
    expect(f.format(val)).toBe(JSON.stringify(formatted));
  });

  test("bar valid", async () => {
    const val = {
      bar_uuid: v1(),
      bar_int: 2,
      bar_string: "string",
      bar_bool: false,
      bar_ts: d,
      bar_float: 2.4,
    };
    const formatted = {
      ...val,
      bar_ts: d.toISOString(),
    };
    expect(await f.valid(val)).toBe(true);
    expect(f.format(val)).toBe(JSON.stringify(formatted));

    const val2 = {
      bar_uuid: v1(),
      bar_int: 2,
      bar_string: "string",
      bar_bool: false,
      bar_ts: d,
      bar_float: 2.4,
      bar_enum: null,
    };
    const formatted2 = {
      ...val2,
      bar_ts: d.toISOString(),
    };
    expect(await f.valid(val2)).toBe(true);
    expect(f.format(val2)).toBe(JSON.stringify(formatted2));
  });

  test("baz valid", async () => {
    const val = {
      baz_uuid: v1(),
      baz_int: 2,
      baz_string: "string",
      baz_bool: false,
      baz_ts: d,
    };
    const formatted = {
      ...val,
      baz_ts: d.toISOString(),
    };
    expect(await f.valid(val)).toBe(true);
    expect(f.format(val)).toBe(JSON.stringify(formatted));
  });

  test("invalid", async () => {
    const val = {
      baz_uuid: v1(),
      baz_int: 2,
      baz_string: "string",
      baz_bool: false,
    };
    expect(await f.valid(val)).toBe(false);
  });
});
