import { parseCustomImports, PathResult } from "./index";
import * as path from "path";

let r: PathResult | undefined;
function parse() {
  if (r === undefined) {
    r = parseCustomImports(path.join(__dirname, "./dataz/example1"));
  }
  return r;
}

beforeAll(() => {
  parse();
});

test("AuthResolver", () => {
  const result = parse();
  const info = result.getInfoForClass("AuthResolver");
  expect(info.class).toStrictEqual({
    name: "AuthResolver",
    exported: false,
    defaultExport: false,
  });

  const file = info.file;
  expect(file.path).toEqual(path.join(__dirname, "./dataz/example1/_auth.ts"));
  expect(file.classes.has("UserAuthInput")).toBe(true);
  expect(file.classes.has("UserAuthResponse")).toBe(true);
  expect(file.classes.has("AuthResolver")).toBe(true);

  // confirm one of the imports in the file
  let importInfo = file.imports.get("ID");
  expect(importInfo).toBeDefined();
  expect(importInfo!.defaultImport).toBeFalsy();
  expect(importInfo!.importPath).toBe("../../../core/base");
});

test("ViewerResolver", () => {
  const result = parse();
  const info = result.getInfoForClass("ViewerResolver");
  expect(info.class).toStrictEqual({
    name: "ViewerResolver",
    exported: true,
    defaultExport: true,
  });
});

test("non-existent class", () => {
  const result = parse();
  try {
    result.getInfoForClass("Foo");
    fail("should not have gotten here");
  } catch (e) {
    expect(e.message).toMatch(/expected 1 class with name Foo/);
  }
});
