import { normalizeModuleSpecifierPath } from "./moduleSpecifier.js";

test("normalizes Windows separators for JavaScript module specifiers", () => {
  expect(normalizeModuleSpecifierPath("..\\generated\\user.js")).toBe(
    "../generated/user.js",
  );
});
