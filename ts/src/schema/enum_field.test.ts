import { EnumField, EnumType, IntEnumField, IntEnumType } from "./field";
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
  valid(val: any): boolean;
  format(val: any): any;
}

function testEnum(e: TestField, val: testValue) {
  expect(e.valid(val.value)).toBe(val.valid);
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
  let rainbow = enumF([
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "indigo",
    "violet",
  ]);
  let rainbow2 = enumMapF({
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
        testEnum(rainbow, {
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
        testEnum(rainbow2, {
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
        testEnum(rainbow, {
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
        testEnum(rainbow2, {
          value: color,
          valid: true,
          // the enum values are lowercase so we expect it to be formatted correctly as lowercase
          formatted: color.toLowerCase(),
        });
      },
    );
  });

  test("mixed case", () => {
    expect(rainbow.valid("Violet")).toBe(false);
  });

  test("mixed case map", () => {
    expect(rainbow2.valid("Violet")).toBe(false);
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
  let friendshipStatus = enumF(values);

  test("same case", () => {
    values.forEach((enumValue) => {
      testEnum(friendshipStatus, {
        value: enumValue,
        valid: true,
        formatted: enumValue,
      });
    });
  });

  test("converted", () => {
    values.forEach((enumValue, idx) => {
      expect(friendshipStatus.convertForGQL(enumValue)).toEqual(
        expectedVals[idx],
      );
    });
  });

  test("validate expected", () => {
    expectedVals.forEach((val, idx) => {
      testEnum(friendshipStatus, {
        value: val,
        valid: true,
        // the enum values are lowercase so we expect it to be formatted correctly as lowercase
        formatted: values[idx],
      });
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

  test("all caps", () => {
    ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo", "Violet"].forEach(
      (color) => {
        testEnum(rainbow, {
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
    // we return passed in values since no graphql formatting happening
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
      testEnum(langs, {
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
  function intEnumMapF(map: {}): IntEnumField {
    return IntEnumType({ map });
  }

  let e = intEnumMapF({
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
});
