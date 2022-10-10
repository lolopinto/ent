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

function testEnum(e: TestField, val: testValue) {
  expect(e.valid(val.value)).toBe(val.valid);
  if (val.valid) {
    expect(e.format(val.value), val.value).toBe(val.formatted);
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

  test("valid", () => {
    ["VERIFIED", "UNVERIFIED"].forEach((status) => {
      testEnum(e, {
        valid: true,
        value: status,
        formatted: status,
      });
    });
  });

  test("valid with map", () => {
    ["verified", "unverified"].forEach((status) => {
      testEnum(e2, {
        valid: true,
        value: status,
        formatted: status,
      });
    });
  });

  test("invalid", () => {
    testEnum(e, {
      valid: false,
      value: "HELLO",
    });
  });

  test("invalid with map", () => {
    testEnum(e2, {
      valid: false,
      value: "HELLO",
    });
  });

  test("invalid different case", () => {
    testEnum(e, {
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

  test("same case", () => {
    ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo", "Violet"].forEach(
      (color) => {
        testEnum(rainbow, {
          value: color,
          valid: true,
          formatted: color,
        });
      },
    );
  });

  test("lower case", () => {
    ["red", "orange", "yellow", "green", "blue", "indigo", "violet"].forEach(
      (color) => {
        testEnum(rainbow, {
          value: color,
          valid: false,
        });
      },
    );
  });
});

test("fkey enum", () => {
  let e = EnumType({
    foreignKey: { schema: "Role", column: "role" },
  });
  ["1", "2", "3", "HAPPY", "sad"].forEach((id) => {
    // everything is valid since we don't currently support validating from source
    // and depend on db foreign key validation to do it
    expect(e.valid(id)).toBe(true);
    expect(e.format(id)).toBe(id);
  });
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

  test("valid", () => {
    ["java", "c++", "c#", "js", "ts", "go", "python"].forEach((lang) => {
      testEnum(langs, {
        valid: true,
        value: lang,
        formatted: lang,
      });
    });
  });

  test("invalid different case", () => {
    ["Java", "Ts", "Go"].forEach((lang) => {
      testEnum(langs, {
        valid: false,
        value: lang,
      });
    });
  });

  test("invalid", () => {
    ["apple", "banana", "rainbow"].forEach((lang) => {
      testEnum(langs, {
        valid: false,
        value: lang,
      });
    });
  });
});

describe("errors", () => {
  test("no fkey, no values or maps", () => {
    try {
      EnumType({});
      throw new Error("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /^values or map required if not look up table enum/,
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
        /cannot specify values or map and foreign key for lookup table enum type/,
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
        /cannot specify values or map and foreign key for lookup table enum type/,
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
        /cannot specify values or map and foreign key for lookup table enum type/,
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
        /cannot specify values or map and foreign key for lookup table enum type/,
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

  test("valid", () => {
    [0, 1].forEach((val) => {
      testEnum(e, {
        valid: true,
        value: val,
        formatted: val,
      });
    });
  });

  test("valid strings", () => {
    ["0", "1"].forEach((val) => {
      testEnum(e, {
        valid: true,
        value: val,
        formatted: parseInt(val),
      });
    });
  });

  test("invalid", () => {
    testEnum(e, {
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
