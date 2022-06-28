import PasswordValidator from "password-validator";
import { PasswordType, Password } from "./password";
import * as bcrypt from "bcryptjs";

let schema = new PasswordValidator();
schema
  .is()
  .min(8)
  .is()
  .max(20)
  .has()
  .uppercase()
  .has()
  .lowercase()
  .has()
  .digits()
  .has()
  .not()
  .spaces()
  .has()
  .symbols();
function pw(): Password {
  return PasswordType({ name: "password" }).validate((val: string): boolean => {
    return !!schema.validate(val);
  });
}

describe("password-validator", () => {
  test("too short", async () => {
    expect(pw().valid("hE11$o")).toBe(false);
  });

  test("too long", async () => {
    expect(pw().valid("hellohellohelloA$B1hello")).toBe(false);
  });

  test("no upper", async () => {
    expect(pw().valid("hello1$234")).toBe(false);
  });

  test("no symbols", async () => {
    expect(pw().valid("helloABCDgjsdsd1s")).toBe(false);
  });

  test("no digits", async () => {
    expect(pw().valid("helloABCDgjsdsds$")).toBe(false);
  });

  test("has spaces", async () => {
    expect(pw().valid("helloABCD gjsdsds1$")).toBe(false);
  });

  test("valid", async () => {
    expect(pw().valid("helloABCDgjsdsds1$")).toBe(true);
  });
});

describe("manual format", () => {
  test("min Len", async () => {
    let pw = PasswordType({ name: "password" }).minLen(10);

    expect(pw.valid("hello")).toBe(false);
    expect(pw.valid("hello123456")).toBe(true);
  });

  test("max Len", async () => {
    let pw = PasswordType({ name: "password" }).maxLen(10);

    expect(pw.valid("hello")).toBe(true);
    expect(pw.valid("hellohello")).toBe(true);
    expect(pw.valid("hellohellohello")).toBe(false);
  });

  test("length", async () => {
    let pw = PasswordType({ name: "password" }).length(10);

    expect(pw.valid("hello")).toBe(false);
    expect(pw.valid("hellohello")).toBe(true);
  });

  test("regex match", async () => {
    let pw = PasswordType({ name: "password" }).match(/^[a-zA-Z0-9_-]{5,20}$/);

    // bad regex!
    expect(pw.valid("password")).toBe(true);
    expect(pw.valid("Pa$$w0rd")).toBe(false);
  });

  test("regex does not match", async () => {
    let pw = PasswordType({ name: "password" }).doesNotMatch(
      /^[a-zA-Z0-9_-]{5,20}$/,
    );

    // bad regex!
    expect(pw.valid("password")).toBe(false);
    expect(pw.valid("Pa$$w0rd")).toBe(true);
  });
});

describe("password format", () => {
  async function testPw(password: string, cost?: number) {
    let p = pw();
    if (cost) {
      p = pw().cost(cost);
    }
    let hash = await p.format(password);
    expect(hash).not.toEqual(password);

    // default cost
    expect(bcrypt.getRounds(hash)).toBe(cost || 10);

    expect(bcrypt.compareSync(password, hash)).toBe(true);
  }

  test("format no cost", async () => {
    await testPw("Pa$$w0rd");
  });

  test("format no cost", async () => {
    await testPw("Pa$$w0rd", 12); // not going higher than this because we want test to be fast enough
  });
});

test("log value", () => {
  expect(pw().logValue("password")).toEqual("********");
});
