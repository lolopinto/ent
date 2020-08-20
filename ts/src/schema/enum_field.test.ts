import { EnumField, EnumType } from "./field";

function enumF(name: string, values: string[]): EnumField {
  return EnumType({ name, values });
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

  test("valid", () => {
    ["VERIFIED", "UNVERIFIED"].forEach((status) => {
      testEnum(e, {
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

  test("mixed case", () => {
    expect(e.valid("Violet")).toBe(false);
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
