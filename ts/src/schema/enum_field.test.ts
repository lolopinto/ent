import { clearGlobalSchema, setGlobalSchema } from "../core/global_schema";
import {
  EnumField,
  EnumType,
  IntegerEnumField,
  IntegerEnumListType,
  IntegerEnumType,
} from "./field";
import { Field } from "./schema";

function enumF(values: string[]): EnumField {
  return EnumType({ values });
}

function enumMapF(map: {}): EnumField {
  return EnumType({ map });
}

interface testValue {
  value: any;
  valid: boolean;
  formatted?: any;
}

interface TestField extends Field {
  valid(val: any): boolean | Promise<boolean>;
  format(val: any): any;
}

async function testEnum(e: TestField, val: testValue) {
  expect(await e.valid(val.value)).toBe(val.valid);
  if (val.valid) {
    expect(await e.format(val.value), val.value).toBe(val.formatted);
  }
}

async function testListEnum(e: TestField, val: testValue) {
  expect(await e.valid(val.value)).toBe(val.valid);
  if (val.valid) {
    expect(e.format(val.value), val.value).toBe(val.formatted);
  }
}

describe("upper case enum", () => {
  let e = enumF(["VERIFIED", "UNVERIFIED"]);
  let e2 = enumMapF({
    VERIFIED: "verified",
    UNVERIFIED: "unverified",
  });

  test("valid", async () => {
    await Promise.all(
      ["VERIFIED", "UNVERIFIED"].map(async (status) => {
        await testEnum(e, {
          valid: true,
          value: status,
          formatted: status,
        });
      }),
    );
  });

  test("valid with map", async () => {
    await Promise.all(
      ["verified", "unverified"].map(async (status) => {
        testEnum(e2, {
          valid: true,
          value: status,
          formatted: status,
        });
      }),
    );
  });

  test("invalid", async () => {
    await testEnum(e, {
      valid: false,
      value: "HELLO",
    });
  });

  test("invalid with map", async () => {
    await testEnum(e2, {
      valid: false,
      value: "HELLO",
    });
  });

  test("invalid different case", async () => {
    await testEnum(e, {
      valid: false,
      value: "verified",
    });
  });
});

describe("mixed case enum", () => {
  let rainbow = enumF([
    "Red",
    "Orange",
    "Yellow",
    "Green",
    "Blue",
    "Indigo",
    "Violet",
  ]);

  test("same case", async () => {
    await Promise.all(
      ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo", "Violet"].map(
        async (color) => {
          await testEnum(rainbow, {
            value: color,
            valid: true,
            formatted: color,
          });
        },
      ),
    );
  });

  test("lower case", async () => {
    await Promise.all(
      ["red", "orange", "yellow", "green", "blue", "indigo", "violet"].map(
        async (color) => {
          testEnum(rainbow, {
            value: color,
            valid: false,
          });
        },
      ),
    );
  });
});

describe("global enum type values", () => {
  beforeAll(() => {
    setGlobalSchema({
      fields: {
        foo: EnumType({
          values: ["VERIFIED", "UNVERIFIED"],
          tsType: "Foo",
        }),
      },
    });
  });

  afterAll(() => {
    clearGlobalSchema();
  });

  const e = EnumType({
    globalType: "Foo",
  });

  test("valid", async () => {
    await testEnum(e, {
      valid: true,
      value: "VERIFIED",
      formatted: "VERIFIED",
    });
    await testEnum(e, {
      valid: true,
      value: "UNVERIFIED",
      formatted: "UNVERIFIED",
    });
  });

  test("invalid", async () => {
    await testEnum(e, {
      valid: false,
      value: "sfsfsf",
    });
  });
});

describe("global enum type map", () => {
  beforeAll(() => {
    setGlobalSchema({
      fields: {
        foo: EnumType({
          map: { VERIFIED: "verified", UNVERIFIED: "unverified" },
          tsType: "Foo",
        }),
      },
    });
  });

  afterAll(() => {
    clearGlobalSchema();
  });

  const e = EnumType({
    globalType: "Foo",
  });

  test("valid", async () => {
    await testEnum(e, {
      valid: true,
      value: "verified",
      formatted: "verified",
    });
    await testEnum(e, {
      valid: true,
      value: "unverified",
      formatted: "unverified",
    });
  });

  test("invalid", async () => {
    await testEnum(e, {
      valid: false,
      value: "blahdsds",
    });
  });
});

test("fkey enum", async () => {
  let e = EnumType({
    foreignKey: { schema: "Role", column: "role" },
  });
  await Promise.all(
    ["1", "2", "3", "HAPPY", "sad"].map(async (id) => {
      // everything is valid since we don't currently support validating from source
      // and depend on db foreign key validation to do it
      expect(await e.valid(id)).toBe(true);
      expect(e.format(id)).toBe(id);
    }),
  );
});

describe("weird maps", () => {
  let langs = enumMapF({
    Java: "java",
    CPlusPlus: "c++",
    CSharp: "c#",
    JavaScript: "js", // need to be Javascript, Typescript, Golang if we don't want the _
    TypeScript: "ts",
    GoLang: "go",
    Python: "python",
  });

  test("valid", async () => {
    await Promise.all(
      ["java", "c++", "c#", "js", "ts", "go", "python"].map(async (lang) => {
        await testEnum(langs, {
          valid: true,
          value: lang,
          formatted: lang,
        });
      }),
    );
  });

  test("invalid different case", async () => {
    await Promise.all(
      ["Java", "Ts", "Go"].map(async (lang) => {
        await testEnum(langs, {
          valid: false,
          value: lang,
        });
      }),
    );
  });

  test("invalid", async () => {
    await Promise.all(
      ["apple", "banana", "rainbow"].map(async (lang) => {
        await testEnum(langs, {
          valid: false,
          value: lang,
        });
      }),
    );
  });
});

describe("errors", () => {
  test("no fkey, no values or maps", () => {
    try {
      EnumType({});
      throw new Error("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /^values, map or globalType required if not look up table enum/,
      );
    }
  });

  test("zero-length values", () => {
    try {
      EnumType({ values: [] });
      throw new Error("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(/need at least one value in enum type/);
    }
  });

  test("empty map", () => {
    try {
      EnumType({ map: {} });
      throw new Error("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(/need at least one entry in enum map/);
    }
  });

  test("fkey and values provided", () => {
    try {
      EnumType({
        values: ["sss"],
        foreignKey: { schema: "Role", column: "role" },
      });
      throw new Error("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify values, map or globalType and foreign key for lookup table enum type/,
      );
    }
  });

  test("fkey and map provided", () => {
    try {
      EnumType({
        map: { sss: "sss" },
        foreignKey: { schema: "Role", column: "role" },
      });
      throw new Error("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify values, map or globalType and foreign key for lookup table enum type/,
      );
    }
  });

  test("fkey and empty values provided", () => {
    try {
      EnumType({
        values: [],
        foreignKey: { schema: "Role", column: "role" },
      });
      throw new Error("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify values, map or globalType and foreign key for lookup table enum type/,
      );
    }
  });

  test("fkey and empty map provided", () => {
    try {
      EnumType({
        map: {},
        foreignKey: { schema: "Role", column: "role" },
      });
      throw new Error("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify values, map or globalType and foreign key for lookup table enum type/,
      );
    }
  });

  test("createEnumType invalid", () => {
    try {
      EnumType({
        foreignKey: { schema: "Role", column: "role" },
        createEnumType: true,
      });
      throw new Error("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify createEnumType without specifying values/,
      );
    }
  });

  test("tsType invalid", () => {
    try {
      EnumType({
        foreignKey: { schema: "Role", column: "role" },
        tsType: "Role",
      });
      throw new Error("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify tsType without specifying values/,
      );
    }
  });

  test("graphqlType invalid", () => {
    try {
      EnumType({
        foreignKey: { schema: "Role", column: "role" },
        graphQLType: "Role",
      });
      throw new Error("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify graphQLType without specifying values/,
      );
    }
  });
});

describe("int enum", () => {
  function intEnumF(map: {}): IntegerEnumField {
    return IntegerEnumType({ map });
  }

  function intEnumListF(map: {}) {
    return IntegerEnumListType({ map });
  }

  let e = intEnumF({
    VERIFIED: 0,
    UNVERIFIED: 1,
  });

  let list = intEnumListF({
    VERIFIED: 0,
    UNVERIFIED: 1,
  });

  test("valid", async () => {
    await Promise.all(
      [0, 1].map(async (val) => {
        await testEnum(e, {
          valid: true,
          value: val,
          formatted: val,
        });
      }),
    );
  });

  test("valid strings", async () => {
    await Promise.all(
      ["0", "1"].map(async (val) => {
        await testEnum(e, {
          valid: true,
          value: val,
          formatted: parseInt(val),
        });
      }),
    );
  });

  test("invalid", async () => {
    await testEnum(e, {
      valid: false,
      value: 2,
    });
  });

  test("list valid", async () => {
    await Promise.all(
      [[0, 1], [0], [1]].map(async (val) => {
        await testListEnum(list, {
          valid: true,
          value: val,
          formatted: `{${val.map((v) => v).join(",")}}`,
        });
      }),
    );
  });

  test("list valid strings", async () => {
    await Promise.all(
      [["0", "1"], ["0"], ["1"]].map(async (val) => {
        await testListEnum(list, {
          valid: true,
          value: val,
          formatted: `{${val.map((v) => parseInt(v)).join(",")}}`,
        });
      }),
    );
  });

  test("list invalid", async () => {
    await testListEnum(list, {
      valid: false,
      value: [2],
    });
  });
});

describe("int enum. global enum", () => {
  beforeAll(() => {
    setGlobalSchema({
      fields: {
        foo: IntegerEnumType({
          map: { VERIFIED: 0, UNVERIFIED: 1 },
          tsType: "Foo",
        }),
      },
    });
  });

  afterAll(() => {
    clearGlobalSchema();
  });

  const e = IntegerEnumType({
    globalType: "Foo",
  });

  test("valid", async () => {
    await testEnum(e, {
      valid: true,
      value: 0,
      formatted: 0,
    });
    await testEnum(e, {
      valid: true,
      value: 1,
      formatted: 1,
    });
  });

  test("invalid", async () => {
    await testEnum(e, {
      valid: false,
      value: 2,
    });
  });
});
