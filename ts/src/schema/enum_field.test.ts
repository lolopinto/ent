import { EnumField, EnumType } from "./field";

function enumF(name: string, values: string[]): EnumField {
  return EnumType({ name, values });
}

test("valid", () => {
  expect(
    enumF("AccountStatus", ["VERIFIED", "UNVERIFIED"]).valid("VERIFIED"),
  ).toBe(true);
});

test("invalid", () => {
  expect(
    enumF("AccountStatus", ["VERIFIED", "UNVERIFIED"]).valid("HELLO"),
  ).toBe(false);
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
    expect(e.valid("red")).toBe(true);
    expect(e.valid("orange")).toBe(true);
    expect(e.valid("yellow")).toBe(true);
    expect(e.valid("green")).toBe(true);
    expect(e.valid("blue")).toBe(true);
    expect(e.valid("indigo")).toBe(true);
    expect(e.valid("violet")).toBe(true);
  });

  test("all caps", () => {
    expect(e.valid("RED")).toBe(true);
    expect(e.valid("ORANGE")).toBe(true);
    expect(e.valid("YELLOW")).toBe(true);
    expect(e.valid("GREEN")).toBe(true);
    expect(e.valid("BLUE")).toBe(true);
    expect(e.valid("INDIGO")).toBe(true);
    expect(e.valid("VIOLET")).toBe(true);
  });

  test("mixed case", () => {
    expect(e.valid("Violet")).toBe(false);
  });
});
