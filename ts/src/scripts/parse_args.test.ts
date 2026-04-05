const { parseArgs } = require("./parse_args.js");

describe("parseArgs", () => {
  test("parses long options, coercion, aliases, and positional args", () => {
    const options = parseArgs([
      "--path",
      "foo",
      "--old-base-class=Bar",
      "--enabled=true",
      "tail",
    ]);

    expect(options).toMatchObject({
      _: ["tail"],
      path: "foo",
      old_base_class: "Bar",
      enabled: true,
    });
  });

  test("parses negative booleans and short flags", () => {
    const options = parseArgs(["--no-baz", "-x", "value", "-abc"]);

    expect(options).toMatchObject({
      _: [],
      baz: false,
      x: "value",
      a: true,
      b: true,
      c: true,
    });
  });

  test("stops parsing after double dash", () => {
    const options = parseArgs(["--path", "foo", "--", "--not-a-flag", "-z"]);

    expect(options).toMatchObject({
      path: "foo",
      _: ["--not-a-flag", "-z"],
    });
  });
});
