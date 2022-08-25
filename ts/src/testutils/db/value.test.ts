import {
  IntegerType,
  FieldOptions,
  StringOptions,
  StringType,
  TimestampType,
  FloatType,
  BooleanType,
  UUIDType,
  TimeType,
  TimetzType,
  TimestamptzType,
  DateType,
  EnumType,
  Schema,
  Field,
  StringListType,
  IntListType,
  JSONBType,
  JSONType,
  JSONBListType,
  JSONBTypeAsList,
  IntegerEnumType,
} from "../../schema";
import { getDefaultValue } from "./value";
import { validate as validateUUid } from "uuid";
import { DateTime } from "luxon";

function strField(opts?: StringOptions) {
  return StringType(opts);
}

async function testString(col: string, opts?: StringOptions) {
  const val = await getDefaultValue(strField(opts), col);
  expect(val).toBeDefined();
  expect(typeof val).toBe("string");
  return val;
}

function isUpper(l: string) {
  return l.toLowerCase() != l.toUpperCase();
}

function intField(opts?: FieldOptions) {
  return IntegerType(opts);
}

function floatField(opts?: FieldOptions) {
  return FloatType(opts);
}

function boolField(opts?: FieldOptions) {
  return BooleanType(opts);
}

describe("strings", () => {
  test("string", async () => {
    await testString("foo");
  });

  test("email", async () => {
    const val = await testString("email_address");
    expect(val.indexOf("@email.com")).toBeGreaterThan(0);
  });

  test("email at end", async () => {
    const val = await testString("primary_email");
    expect(val.indexOf("@email.com")).toBeGreaterThan(0);
  });

  test("phone number", async () => {
    const val = await testString("phone_number");
    expect(val.indexOf("+1")).toBe(0);
  });

  test("phone number at end", async () => {
    const val = await testString("secondary_phone_number");
    expect(val.indexOf("+1")).toBe(0);
  });

  test("phone", async () => {
    const val = await testString("phone");
    expect(val.indexOf("+1")).toBe(0);
  });

  test("password", async () => {
    // password is just a string because of speed issues since we may be generating a lot of rows
    await testString("password");
  });

  test("first name", async () => {
    const val = await testString("first_name");
    expect(isUpper(val[0])).toBeTruthy();
  });

  test("last name", async () => {
    const val = await testString("last_name");
    expect(isUpper(val[0])).toBeTruthy();
  });
});

test("int", async () => {
  const val = await getDefaultValue(intField(), "col");
  expect(typeof val).toBe("number");
  expect(Number.isInteger(val)).toBe(true);
});

test("float", async () => {
  const val = await getDefaultValue(floatField(), "col");
  expect(typeof val).toBe("number");
  expect(Number.isInteger(val)).toBe(false);
});

test("bool", async () => {
  const val = await getDefaultValue(boolField(), "col");
  expect(typeof val).toBe("boolean");
});

test("uuid", async () => {
  const val = await getDefaultValue(UUIDType(), "id");
  expect(typeof val).toBe("string");
  expect(validateUUid(val)).toBe(true);
});

test("time", async () => {
  const val = await getDefaultValue(TimeType(), "time");
  expect(typeof val).toBe("string");
  expect(DateTime.fromSQL(val).isValid).toBe(true);
});

test("timetz", async () => {
  const val = await getDefaultValue(TimetzType(), "time");
  expect(typeof val).toBe("string");
  expect(DateTime.fromSQL(val).isValid).toBe(true);
});

test("timestamp", async () => {
  const val = await getDefaultValue(TimestampType(), "time");
  expect(typeof val).toBe("string");
  expect(DateTime.fromISO(val).isValid).toBe(true);
});

test("timestamptz", async () => {
  const val = await getDefaultValue(TimestamptzType(), "time");
  expect(typeof val).toBe("string");
  expect(DateTime.fromISO(val).isValid).toBe(true);
});

test("date", async () => {
  const val = await getDefaultValue(DateType(), "date");
  expect(typeof val).toBe("string");
  // yyyy-mm-dd
  expect(val).toMatch(/\d\d\d\d-\d\d-\d\d/);
});

test("enum", async () => {
  const values = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const typ = EnumType({ values: values });
  const val = await getDefaultValue(typ, "col");
  expect(typeof val).toBe("string");
  expect(values.indexOf(val)).toBeGreaterThanOrEqual(0);
});

test("enum map", async () => {
  const m = {
    sun: "Sunday",
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
  };
  const typ = EnumType({ map: m });
  const val = await getDefaultValue(typ, "col");
  expect(typeof val).toBe("string");
  expect(Object.values(m).indexOf(val)).toBeGreaterThanOrEqual(0);
});

test("int enum map", async () => {
  const m = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  const typ = IntegerEnumType({ map: m });
  const val = await getDefaultValue(typ, "col");
  expect(typeof val).toBe("number");
  expect(Object.values(m).indexOf(val)).toBeGreaterThanOrEqual(0);
});

describe("fkey enum", () => {
  test("valid", async () => {
    class RequestStatus implements Schema {
      fields: Field[] = [
        StringType({
          name: "status",
          primaryKey: true,
        }),
      ];

      enumTable = true;

      dbRows = [
        {
          status: "OPEN",
        },
        {
          status: "PENDING_FULFILLMENT",
        },
        {
          status: "CLOSED",
        },
      ];
    }

    const typ = EnumType({
      name: "foo",
      foreignKey: { schema: "RequestStatus", column: "status" },
    });

    const m = new Map<
      string,
      {
        schema: Schema;
      }
    >();
    m.set("RequestStatus", {
      schema: new RequestStatus(),
    });
    const val = await getDefaultValue(typ, "col", m);
    expect(typeof val).toBe("string");
    expect(
      ["OPEN", "PENDING_FULFILLMENT", "CLOSED"].indexOf(val),
    ).toBeGreaterThanOrEqual(0);
  });

  test("invalid", async () => {
    const typ = EnumType({
      name: "foo",
      foreignKey: { schema: "RequestStatus", column: "status" },
    });

    try {
      await getDefaultValue(typ, "col");
      fail("should have thrown");
    } catch (err) {
      expect(err.message).toMatch(/infos required for enum with foreignKey/);
    }
  });
});

test("string list", async () => {
  const val = await getDefaultValue(StringListType(), "list");
  expect(val).toBeDefined();
  const l = val.slice(1, val.length - 1).split(",");
  // hardcoded as 10
  // it's postgres format so not going farther than this
  expect(l.length).toBe(10);
});

test("int list", async () => {
  const val = await getDefaultValue(IntListType(), "list");
  expect(val).toBeDefined();
  const l = val.slice(1, val.length - 1).split(",");
  // hardcoded as 10
  expect(l.length).toBe(10);
  for (const v of l) {
    const i = parseInt(v);
    expect(typeof i === "number").toBe(true);
  }
});

test("jsonb", async () => {
  const val = await getDefaultValue(JSONBType(), "jsonb");
  expect(val).toBeDefined();
  expect(val).toBe(`{}`);
});

test("json", async () => {
  const val = await getDefaultValue(JSONType(), "json");
  expect(val).toBeDefined();
  expect(val).toBe(`{}`);
});

test("jsonb list", async () => {
  const val = await getDefaultValue(JSONBTypeAsList(), "jsonb_list");
  expect(val).toBeDefined();
  expect(typeof val).toBe("string");
  const l = JSON.parse(val);
  expect(l.length).toBe(10);
  for (const v of l) {
    expect(v).toBe(`{}`);
  }
});

test("default value on create", async () => {
  const m = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  const typ = IntegerEnumType({ map: m, defaultValueOnCreate: () => 5 });
  const val = await getDefaultValue(typ, "col");
  expect(val).toBe(5);
});
