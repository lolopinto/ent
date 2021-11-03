import each from "jest-each";
import { Allow, Skip, Deny, PrivacyResult } from "./base";

each([
  ["Allow", Allow],
  ["Deny", Deny],
  ["Skip", Skip],
]).test(`equality %s`, (name, fn: () => PrivacyResult) => {
  expect(fn() == fn()).toBe(true);
  expect(fn() === fn()).toBe(true);
});
