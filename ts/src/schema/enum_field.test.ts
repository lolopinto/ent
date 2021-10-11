import { EnumField, EnumType } from "./field";

function enumF(name: string, values: string[]): EnumField {
  return EnumType({ name, values });
}

function enumMapF(name: string, map: {}): EnumField {
  return EnumType({ name, map });
}

interface testValue {
  value: string;
  valid: boolean;
  formatted?: string;
}

function testEnum(e: EnumField, val: testValue) {
  expect(e.valid(val.value)).toBe(val.valid);
  if (val.valid) {
    expect(e.format(val.value), val.value).toBe(val.formatted);
  }
}

describe("upper case enum", () => {
  let e = enumF("AccountStatus", ["VERIFIED", "UNVERIFIED"]);
  let e2 = enumMapF("AccountStatus", {
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

    ["VERIFIED", "UNVERIFIED"].forEach((status) => {
      testEnum(e2, {
        valid: true,
        value: status,
        formatted: status.toLowerCase(),
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

describe("gql support", () => {
  let e = enumF("rainbow", [
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "indigo",
    "violet",
  ]);
  let e2 = enumMapF("rainbow", {
    Red: "red",
    Orange: "orange",
    Yellow: "yellow",
    Green: "green",
    Blue: "blue",
    Indigo: "indigo",
    Violet: "violet",
  });

  test("same case", () => {
    ["red", "orange", "yellow", "green", "blue", "indigo", "violet"].forEach(
      (color) => {
        testEnum(e, {
          value: color,
          valid: true,
          formatted: color,
        });
      },
    );
  });

  test("same case map", () => {
    ["red", "orange", "yellow", "green", "blue", "indigo", "violet"].forEach(
      (color) => {
        testEnum(e2, {
          value: color,
          valid: true,
          formatted: color,
        });
      },
    );
  });

  test("all caps", () => {
    ["RED", "ORANGE", "YELLOW", "GREEN", "BLUE", "INDIGO", "VIOLET"].forEach(
      (color) => {
        testEnum(e, {
          value: color,
          valid: true,
          // the enum values are lowercase so we expect it to be formatted correctly as lowercase
          formatted: color.toLowerCase(),
        });
      },
    );
  });

  test("all caps map", () => {
    ["RED", "ORANGE", "YELLOW", "GREEN", "BLUE", "INDIGO", "VIOLET"].forEach(
      (color) => {
        testEnum(e2, {
          value: color,
          valid: true,
          // the enum values are lowercase so we expect it to be formatted correctly as lowercase
          formatted: color.toLowerCase(),
        });
      },
    );
  });

  test("mixed case", () => {
    expect(e.valid("Violet")).toBe(false);
  });

  test("mixed case map", () => {
    expect(e2.valid("Violet")).toBe(false);
  });
});

describe("gql support camel case", () => {
  const values = [
    "areFriends",
    "outgoingFriendRequest",
    "incomingFriendRequest",
    "canSendRequest",
    "cannotRequest",
  ];
  const expectedVals = [
    "ARE_FRIENDS",
    "OUTGOING_FRIEND_REQUEST",
    "INCOMING_FRIEND_REQUEST",
    "CAN_SEND_REQUEST",
    "CANNOT_REQUEST",
  ];
  let e = enumF("friendship status", values);

  test("same case", () => {
    values.forEach((enumValue) => {
      testEnum(e, {
        value: enumValue,
        valid: true,
        formatted: enumValue,
      });
    });
  });

  test("converted", () => {
    values.forEach((enumValue, idx) => {
      expect(e.convertForGQL(enumValue)).toEqual(expectedVals[idx]);
    });
  });

  test("validate expected", () => {
    expectedVals.forEach((val, idx) => {
      testEnum(e, {
        value: val,
        valid: true,
        // the enum values are lowercase so we expect it to be formatted correctly as lowercase
        formatted: values[idx],
      });
    });
  });
});

describe("mixed case enum", () => {
  let e = enumF("rainbow", [
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
        testEnum(e, {
          value: color,
          valid: true,
          formatted: color,
        });
      },
    );
  });

  test("all caps", () => {
    ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo", "Violet"].forEach(
      (color) => {
        testEnum(e, {
          // value passed is uppercase
          value: color.toUpperCase(),
          valid: true,
          // formatted value is title case saved value
          formatted: color,
        });
      },
    );
  });

  test("lower case", () => {
    ["red", "orange", "yellow", "green", "blue", "indigo", "violet"].forEach(
      (color) => {
        testEnum(e, {
          value: color,
          valid: false,
        });
      },
    );
  });
});

test("fkey enum", () => {
  let e = EnumType({
    name: "role",
    foreignKey: { schema: "Role", column: "role" },
  });
  ["1", "2", "3", "HAPPY", "sad"].forEach((id) => {
    // everything is valid since we don't currently support validating from source
    // and depend on db foreign key validation to do it
    expect(e.valid(id)).toBe(true);
    // we return passed in values since no graphql formatting happening
    expect(e.format(id)).toBe(id);
  });
});

describe("weird maps", () => {
  let e = enumMapF("langs", {
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
      testEnum(e, {
        valid: true,
        value: lang,
        formatted: lang,
      });
    });
  });

  test("invalid different case", () => {
    ["Java", "Ts", "Go"].forEach((lang) => {
      testEnum(e, {
        valid: false,
        value: lang,
      });
    });
  });

  test("invalid", () => {
    ["apple", "banana", "rainbow"].forEach((lang) => {
      testEnum(e, {
        valid: false,
        value: lang,
      });
    });
  });

  test("gql support", () => {
    [
      ["JAVA", "java"],
      ["C_PLUS_PLUS", "c++"],
      ["C_SHARP", "c#"],
      ["JAVA_SCRIPT", "js"],
      ["TYPE_SCRIPT", "ts"],
      ["GO_LANG", "go"],
      ["PYTHON", "python"],
    ].forEach((lang) => {
      testEnum(e, {
        valid: true,
        value: lang[0],
        formatted: lang[1],
      });
    });
  });
});

describe("errors", () => {
  test("no fkey, no values or maps", () => {
    try {
      EnumType({ name: "role" });
      fail("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /^values or map required if not look up table enum/,
      );
    }
  });

  test("zero-length values", () => {
    try {
      EnumType({ name: "role", values: [] });
      fail("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(/need at least one value in enum type/);
    }
  });

  test("empty map", () => {
    try {
      EnumType({ name: "role", map: {} });
      fail("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(/need at least one entry in enum map/);
    }
  });

  test("fkey and values provided", () => {
    try {
      EnumType({
        name: "role",
        values: ["sss"],
        foreignKey: { schema: "Role", column: "role" },
      });
      fail("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify values or map and foreign key for lookup table enum type/,
      );
    }
  });

  test("fkey and map provided", () => {
    try {
      EnumType({
        name: "role",
        map: { sss: "sss" },
        foreignKey: { schema: "Role", column: "role" },
      });
      fail("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify values or map and foreign key for lookup table enum type/,
      );
    }
  });

  test("fkey and empty values provided", () => {
    try {
      EnumType({
        name: "role",
        values: [],
        foreignKey: { schema: "Role", column: "role" },
      });
      fail("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify values or map and foreign key for lookup table enum type/,
      );
    }
  });

  test("fkey and empty map provided", () => {
    try {
      EnumType({
        name: "role",
        map: {},
        foreignKey: { schema: "Role", column: "role" },
      });
      fail("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify values or map and foreign key for lookup table enum type/,
      );
    }
  });

  test("createEnumType invalid", () => {
    try {
      EnumType({
        name: "role",
        foreignKey: { schema: "Role", column: "role" },
        createEnumType: true,
      });
      fail("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify createEnumType without specifying values/,
      );
    }
  });

  test("tsType invalid", () => {
    try {
      EnumType({
        name: "role",
        foreignKey: { schema: "Role", column: "role" },
        tsType: "Role",
      });
      fail("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify tsType without specifying values/,
      );
    }
  });

  test("graphqlType invalid", () => {
    try {
      EnumType({
        name: "role",
        foreignKey: { schema: "Role", column: "role" },
        graphQLType: "Role",
      });
      fail("shouldn't get here");
    } catch (err) {
      expect(err.message).toMatch(
        /cannot specify graphQLType without specifying values/,
      );
    }
  });
});
