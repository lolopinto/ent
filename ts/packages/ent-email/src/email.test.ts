import exp from "constants";
import { EmailType, EmailListType, Email } from "./email";

function testCase(exp: expectedResult) {
  let typ = EmailType({ name: "emailAddress" });
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
  pre?: (typ: Email) => Email;
}

test("simple", () => {
  testCase({
    input: "test@email.com",
    output: "test@email.com",
  });
});

test("trailing space", () => {
  testCase({
    input: "test@email.com ",
    output: "test@email.com",
  });
});

test("leading space", () => {
  testCase({
    input: " test@email.com",
    output: "test@email.com",
  });
});

test("tabs", () => {
  testCase({
    input: "\ttest@email.com",
    output: "test@email.com",
  });
});

test("with capps", () => {
  testCase({
    input: "Test@Email.com",
    output: "test@email.com",
  });
});

test("all caps", () => {
  testCase({
    input: "TEST@EMAIL.com",
    output: "test@email.com",
  });
});

test("with dash", () => {
  testCase({
    input: "first-last@email.com",
    output: "first-last@email.com",
  });
});

test("with email", () => {
  testCase({
    input: "first.last@email.com",
    output: "first.last@email.com",
  });
});

test("with missing @", () => {
  testCase({
    input: "test.email.com",
    invalid: true,
  });
});

test("no .com", () => {
  testCase({
    input: "first.last@email",
    output: "first.last@email",
  });
});

test("with gmail+", () => {
  testCase({
    input: "test+spam@email.com",
    output: "test+spam@email.com",
  });
});

test("with underscore", () => {
  testCase({
    input: "first_last@email.com",
    output: "first_last@email.com",
  });
});

test("with name", () => {
  testCase({
    input: "first last <first.last@email.com>",
    invalid: true,
  });
});

test("with comments", () => {
  testCase({
    input: "first last (comment) <first.last@email.com>",
    invalid: true,
  });
});

test("restrict domain", () => {
  testCase({
    pre: (typ) => typ.domain("email.com"),
    input: "first_last@email.com",
    output: "first_last@email.com",
  });
});

test("restrict domain. invalid ", () => {
  testCase({
    pre: (typ) => typ.domain("email.com"),
    input: "first_last@bar.com",
    invalid: true,
  });
});

test("list", () => {
  const tt = EmailListType({ name: "emails" });
  const input = ["first_last@email.com", "first_last@bar.com"];
  expect(tt.valid(input)).toBe(true);
  // postgres stored in db style
  expect(tt.format(input)).toEqual(`{${input.join(",")}}`);
});

test("list with invalid", () => {
  const tt = EmailListType({ name: "emails" });
  const input = [
    "first_last@email.com",
    "first_last@bar.com",
    "  first last(comment) < first.last@email.com>",
  ];
  expect(tt.valid(input)).toBe(false);
});
