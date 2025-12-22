import { Allow, Skip, Deny, PrivacyResult } from "./base.js";

test.each([
  ["Allow", Allow],
  ["Deny", Deny],
  ["Skip", Skip],
])(`equality %s`, (name, fn: () => PrivacyResult) => {
  expect(fn() == fn()).toBe(true);
  expect(fn() === fn()).toBe(true);
});
