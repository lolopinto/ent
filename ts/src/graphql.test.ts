import { gqlField, gqlArg, GQLCapture, Func } from "./graphql";
import { GraphQLInt, GraphQLFloat } from "graphql";

beforeEach(() => {
  GQLCapture.clear();
  GQLCapture.enable(true);
});

function validateOne(customFns: Func[], expected: Func) {
  expect(customFns.length).toBe(1);
  let customFn = customFns[0];
  expect(customFn.nodeName).toBe(expected.nodeName);
  expect(customFn.functionName).toBe(expected.functionName);
  expect(customFn.gqlName).toBe(expected.gqlName);

  let results = customFn.results;
  expect(results.length).toBe(1);
  expect(expected.results.length).toBe(1);
  expect(results[0].type).toBe(expected.results[0].type);
  expect(results[0].name).toBe(expected.results[0].name);

  expect(customFn.args.length).toBe(expected.args.length);

  if (expected.args.length) {
    for (let i = 0; i < expected.args.length; i++) {
      let expectedArg = expected.args[i];
      let actualArg = customFn.args[i];

      expect(actualArg.type).toBe(expectedArg.type);
      expect(actualArg.name).toBe(expectedArg.name);
    }
  }
}

describe("accessor", () => {
  test("disabled", () => {
    GQLCapture.enable(false);
    class User {
      @gqlField()
      get fullName(): string {
        return "fullName";
      }
    }
    expect(GQLCapture.getCustomFns().length).toBe(0);
  });

  test("enabled. string", () => {
    class User {
      @gqlField()
      get fullName(): string {
        return "fullName";
      }
    }
    let customFns = GQLCapture.getCustomFns();

    validateOne(customFns, {
      nodeName: "User",
      functionName: "fullName",
      gqlName: "fullName",
      results: [
        {
          type: "String",
          name: "",
        },
      ],
      args: [],
    });
  });

  test("enabled. int", () => {
    class User {
      @gqlField({ type: GraphQLInt })
      get age(): number {
        return 3.2;
      }
    }
    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      results: [
        {
          type: "Int",
          name: "",
        },
      ],
      args: [],
    });
  });

  test("enabled. float", () => {
    class User {
      @gqlField({ type: GraphQLFloat })
      get age(): number {
        return 3.2;
      }
    }
    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      results: [
        {
          type: "Float",
          name: "",
        },
      ],
      args: [],
    });
  });

  test("enabled. returns float with implicit number", () => {
    class User {
      @gqlField({ type: GraphQLFloat })
      get age() {
        return 3.2;
      }
    }
    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      results: [
        {
          type: "Float",
          name: "",
        },
      ],
      args: [],
    });
  });

  test("enabled. returns int with implicit number", () => {
    class User {
      @gqlField({ type: GraphQLInt })
      get age() {
        return 3.2;
      }
    }
    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      results: [
        {
          type: "Int",
          name: "",
        },
      ],
      args: [],
    });
  });

  test("enabled. throws with number and no type", () => {
    try {
      class User {
        @gqlField()
        get age(): number {
          return 3.2;
        }
      }
      fail("should not get here");
    } catch (e) {
      expect(e.message).toMatch(/^type is required (.)+/);
    }
  });

  test("enabled. throws with implicit type and no passed in type", () => {
    try {
      class User {
        @gqlField()
        get age() {
          return 3.2;
        }
      }
      fail("should not get here");
    } catch (e) {
      expect(e.message).toMatch(/^type is required (.)+/);
    }
  });
});

describe("property", () => {
  test("disabled", () => {
    GQLCapture.enable(false);
    class User {
      @gqlField()
      fullName: string;
    }
    expect(GQLCapture.getCustomFns().length).toBe(0);
  });

  test("enabled. string", () => {
    class User {
      @gqlField()
      fullName: string;
    }
    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "fullName",
      gqlName: "fullName",
      results: [
        {
          type: "String",
          name: "",
        },
      ],
      args: [],
    });
  });

  test("enabled. int", () => {
    class User {
      @gqlField({ type: GraphQLInt })
      age: number;
    }
    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      results: [
        {
          type: "Int",
          name: "",
        },
      ],
      args: [],
    });
  });

  test("enabled. float", () => {
    class User {
      @gqlField({ type: GraphQLFloat })
      age: number;
    }
    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      results: [
        {
          type: "Float",
          name: "",
        },
      ],
      args: [],
    });
  });

  test("enabled. with implicit type", () => {
    class User {
      @gqlField({ type: GraphQLFloat })
      // lol but why?
      age;
    }
    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      results: [
        {
          type: "Float",
          name: "",
        },
      ],
      args: [],
    });
  });

  test("enabled. with implicit type", () => {
    try {
      class User {
        @gqlField()
        // lol but why?
        age;
      }
      fail("should not have gotten here");
    } catch (e) {
      expect(e.message).toMatch(/^type is required (.)+/);
    }
  });
});

describe.only("function", () => {
  test("disabled", () => {
    GQLCapture.enable(false);
    class User {
      @gqlField()
      username(): string {
        return "ola";
      }
    }
    expect(GQLCapture.getCustomFns().length).toBe(0);
  });

  test("enabled, returns string", () => {
    class User {
      @gqlField()
      username(): string {
        return "ola";
      }
    }

    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "username",
      gqlName: "username",
      results: [
        {
          type: "String",
          name: "",
        },
      ],
      args: [],
    });
  });

  test("enabled, returns int", () => {
    class User {
      @gqlField({ type: GraphQLInt })
      age(): number {
        return 32;
      }
    }

    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      results: [
        {
          type: "Int",
          name: "",
        },
      ],
      args: [],
    });
  });

  test("enabled, returns float", () => {
    class User {
      @gqlField({ type: GraphQLFloat })
      pi(): number {
        return 3.14;
      }
    }

    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "pi",
      gqlName: "pi",
      results: [
        {
          type: "Float",
          name: "",
        },
      ],
      args: [],
    });
  });

  test("enabled, returns float for implicit return type", () => {
    class User {
      @gqlField({ type: GraphQLFloat })
      pi() {
        return 3.14;
      }
    }

    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "pi",
      gqlName: "pi",
      results: [
        {
          type: "Float",
          name: "",
        },
      ],
      args: [],
    });
  });

  test("enabled, throws for implicit return type", () => {
    try {
      class User {
        @gqlField()
        pi() {
          return 3.14;
        }
      }
    } catch (err) {
      expect(err.message).toMatch(/^type is required (.)+/);
    }
  });

  test("enabled, one param", () => {
    class User {
      @gqlField({ type: GraphQLInt })
      add(@gqlArg("id", { type: GraphQLInt }) base: number): number {
        return 1 + base;
      }
    }

    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "add",
      gqlName: "add",
      results: [
        {
          type: "Int",
          name: "",
        },
      ],
      args: [
        {
          type: "Int",
          name: "id",
        },
      ],
    });
  });

  // TODO other tests with params
  // e.g. object param
  // no @gqlArg
  // nullable, etc
  test("enabled, multiple param", () => {
    class User {
      @gqlField()
      find(
        @gqlArg("pos", { type: GraphQLInt }) pos: number,
        @gqlArg("cursor") cursor: string,
      ): string {
        return `${cursor}:${pos}`;
      }
    }

    let customFns = GQLCapture.getCustomFns();
    validateOne(customFns, {
      nodeName: "User",
      functionName: "find",
      gqlName: "find",
      results: [
        {
          type: "String",
          name: "",
        },
      ],
      args: [
        {
          type: "Int",
          name: "pos",
        },
        {
          type: "String",
          name: "cursor",
        },
      ],
    });
  });
});
