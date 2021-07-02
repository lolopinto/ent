import {
  PhoneNumberType,
  PhoneNumber,
  PhoneNumberListType,
} from "./phonenumber";

function testCase(exp: expectedResult) {
  let typ = PhoneNumberType({ name: "phone" });
  if (exp.pre) {
    typ = exp.pre(typ);
  }
  if (exp.invalid) {
    expect(typ.valid(exp.input)).toBe(false);
    return;
  }

  expect(typ.valid(exp.input)).toBe(true);
  expect(typ.format(exp.input)).toBe(exp.output);
}

interface expectedResult {
  input: string;
  output?: string;
  invalid?: boolean;
  pre?: (typ: PhoneNumber) => PhoneNumber;
}

describe("US", () => {
  test("us", async () => {
    testCase({
      input: "6501234567",
      output: "+16501234567",
    });
  });

  test("us dashes", async () => {
    testCase({
      input: "650-123-4567",
      output: "+16501234567",
    });
  });

  test("us with country code", async () => {
    testCase({
      input: "+16501234567",
      output: "+16501234567",
    });
  });

  test("us national", async () => {
    testCase({
      input: "6501234567",
      pre: (typ) => typ.numberFormat("NATIONAL"),
      output: "(650) 123-4567",
    });
  });

  test("us international", async () => {
    testCase({
      input: "6501234567",
      pre: (typ) => typ.numberFormat("INTERNATIONAL"),
      // different from go!
      output: "+1 650 123 4567",
    });
  });

  test("us-dashes-format-national", async () => {
    testCase({
      input: "650-123-4567",
      pre: (typ) => typ.numberFormat("NATIONAL"),
      output: "(650) 123-4567",
    });
  });

  test("us-national-input", async () => {
    testCase({
      input: "(650) 123-4567",
      output: "+16501234567",
    });
  });

  test("us-national-input-output", async () => {
    testCase({
      input: "(650) 123-4567",
      pre: (typ) => typ.numberFormat("NATIONAL"),
      output: "(650) 123-4567",
    });
  });

  test("us-national-input-output-international", async () => {
    testCase({
      input: "(650) 123-4567",
      pre: (typ) => typ.numberFormat("INTERNATIONAL"),
      // different from go!
      output: "+1 650 123 4567",
    });
  });

  test("us-rfc3966", async () => {
    testCase({
      input: "(650) 123-4567",
      pre: (typ) => typ.numberFormat("RFC3966"),
      // different from go!
      output: "tel:+16501234567",
    });
  });
});

describe("GB region", () => {
  test("GB", async () => {
    testCase({
      input: "07911 123456",
      pre: (typ) => typ.countryCode("GB"),
      output: "+447911123456",
    });
  });

  test("GB international", async () => {
    testCase({
      input: "07911 123456",
      pre: (typ) => typ.countryCode("GB").numberFormat("INTERNATIONAL"),
      output: "+44 7911 123456",
    });
  });

  test("GB national", async () => {
    testCase({
      input: "07911 123456",
      pre: (typ) => typ.countryCode("GB").numberFormat("NATIONAL"),
      output: "07911 123456",
    });
  });

  test("GB RFC3966", async () => {
    testCase({
      input: "07911 123456",
      pre: (typ) => typ.countryCode("GB").numberFormat("RFC3966"),
      output: "tel:+447911123456",
    });
  });
});

describe("invalid", () => {
  test("invalid number", () => {
    testCase({
      input: "1",
      invalid: true,
    });
  });

  test("valid area code. invalid number", () => {
    testCase({
      input: "4152",
      pre: (typ) => typ.validateForRegion(false),
      output: "+14152",
    });
  });

  test("valid area code. invalid number", () => {
    testCase({
      input: "4152",
      invalid: true,
    });
  });

  test("invalid number for region. disable validation", () => {
    testCase({
      input: "07911 123456",
      // disable validation for the region
      pre: (typ) => typ.validateForRegion(false),
      // formats it incorrectly
      output: "+107911123456",
    });
  });

  test("invalid number for region. validate (default)", () => {
    testCase({
      input: "07911 123456",
      invalid: true,
    });
  });

  test("GB. invalid number for region", () => {
    testCase({
      input: "6501234567",
      pre: (typ) => typ.countryCode("GB"),
      // just formats it incorrectly
      output: "+446501234567",
    });
  });

  test("GB. invalid number for region.validate for region", () => {
    testCase({
      input: "6501234567",
      pre: (typ) => typ.countryCode("GB").validateForRegion(true),
      // hmmm
      //      invalid: true,
      output: "+446501234567",
    });
  });
});

describe("with numeric country code", () => {
  test("gb number. US region", () => {
    testCase({
      input: "+44 07911 123456",
      output: "+447911123456",
    });
  });

  test("gb number. US region. international", () => {
    testCase({
      input: "+44 07911 123456",
      pre: (typ) => typ.numberFormat("INTERNATIONAL"),
      output: "+44 7911 123456",
    });
  });

  test("gb number. US region. national", () => {
    testCase({
      input: "+44 07911 123456",
      pre: (typ) => typ.numberFormat("NATIONAL"),
      // whelp countrycalling code not in format...
      // NATIONAL makes no sense
      output: "07911 123456",
    });
  });

  test("gb number. US region. rfc3939", () => {
    testCase({
      input: "+44 07911 123456",
      pre: (typ) => typ.numberFormat("RFC3966"),
      output: "tel:+447911123456",
    });
  });
});

describe("list", () => {
  test("valid", () => {
    let typ = PhoneNumberListType({ name: "numbers" });
    const input = ["4159876543", "6501234567"];
    const expected = ["+14159876543", "+16501234567"];
    expect(typ.valid(input)).toBe(true);
    // postgres stored in db style
    expect(typ.format(input)).toEqual(`{${expected.join(",")}}`);
  });

  test("invalid", () => {
    let typ = PhoneNumberListType({ name: "numbers" });
    const input = ["4159876543", "4152"];
    expect(typ.valid(input)).toBe(false);
  });
});
