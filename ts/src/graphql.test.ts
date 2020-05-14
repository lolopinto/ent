import {
  gqlField,
  gqlArg,
  GQLCapture,
  CustomField,
  gqlArgType,
  Field,
  CustomArg,
} from "./graphql";
import { GraphQLInt, GraphQLFloat } from "graphql";

beforeEach(() => {
  GQLCapture.clear();
  GQLCapture.enable(true);
});

function validateOneCustomField(expected: CustomField) {
  validateCustomFields([expected]);
}

function validateCustomFields(expected: CustomField[]) {
  let customFields = GQLCapture.getCustomFields();
  expect(customFields.length).toBe(expected.length);

  for (let i = 0; i < customFields.length; i++) {
    let customField = customFields[i];
    let expectedCustomField = expected[i];
    expect(customField.nodeName).toBe(expectedCustomField.nodeName);
    expect(customField.functionName).toBe(expectedCustomField.functionName);
    expect(customField.gqlName).toBe(expectedCustomField.gqlName);

    validateFields(customField.results, expectedCustomField.results);

    validateFields(customField.args, expectedCustomField.args);
  }
}

function validateFields(actual: Field[], expected: Field[]) {
  expect(actual.length).toBe(expected.length);

  for (let j = 0; j < actual.length; j++) {
    let field = actual[j];
    let expField = expected[j];

    expect(field.type).toBe(expField.type);
    expect(field.name).toBe(expField.name);
    expect(field.needsResolving).toBe(expField.needsResolving);
  }
}

function validateNoCustomFields() {
  expect(GQLCapture.getCustomFields().length).toBe(0);
}

function validateCustomArgs(expected: CustomArg[]) {
  let args = GQLCapture.getCustomArgs();
  expect(args.length).toBe(expected.length);

  for (let i = 0; i < args.length; i++) {
    let arg = args[i];
    let expectedArg = expected[i];

    expect(arg.className).toBe(expectedArg.className);
    expect(arg.nodeName).toBe(expectedArg.nodeName);
  }
}
function validateNoCustomArgs() {
  expect(GQLCapture.getCustomArgs().length).toBe(0);
}

function validateNoCustom() {
  validateNoCustomFields();
  validateNoCustomArgs();
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
    validateNoCustom();
  });

  test("enabled. string", () => {
    class User {
      @gqlField()
      get fullName(): string {
        return "fullName";
      }
    }

    validateOneCustomField({
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
    validateNoCustomArgs();
  });

  test("enabled. int", () => {
    class User {
      @gqlField({ type: GraphQLInt })
      get age(): number {
        return 3.2;
      }
    }
    validateOneCustomField({
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
    validateNoCustomArgs();
  });

  test("enabled. float", () => {
    class User {
      @gqlField({ type: GraphQLFloat })
      get age(): number {
        return 3.2;
      }
    }
    validateOneCustomField({
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
    validateNoCustomArgs();
  });

  test("enabled. returns float with implicit number", () => {
    class User {
      @gqlField({ type: GraphQLFloat })
      get age() {
        return 3.2;
      }
    }
    validateOneCustomField({
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
    validateNoCustomArgs();
  });

  test("enabled. returns int with implicit number", () => {
    class User {
      @gqlField({ type: GraphQLInt })
      get age() {
        return 3.2;
      }
    }
    validateOneCustomField({
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
    validateNoCustomArgs();
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
    validateNoCustom();
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
    validateNoCustom();
  });
});

describe("property", () => {
  test("disabled", () => {
    GQLCapture.enable(false);
    class User {
      @gqlField()
      fullName: string;
    }
    validateNoCustom();
  });

  test("enabled. string", () => {
    class User {
      @gqlField()
      fullName: string;
    }
    validateOneCustomField({
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
    validateNoCustomArgs();
  });

  test("enabled. int", () => {
    class User {
      @gqlField({ type: GraphQLInt })
      age: number;
    }
    validateOneCustomField({
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
    validateNoCustomArgs();
  });

  test("enabled. float", () => {
    class User {
      @gqlField({ type: GraphQLFloat })
      age: number;
    }
    validateOneCustomField({
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
    validateNoCustomArgs();
  });

  test("enabled. with implicit type", () => {
    class User {
      @gqlField({ type: GraphQLFloat })
      // lol but why?
      age;
    }
    validateOneCustomField({
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
    validateNoCustomArgs();
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
    validateNoCustom();
  });
});

describe("function", () => {
  test("disabled", () => {
    GQLCapture.enable(false);
    class User {
      @gqlField()
      username(): string {
        return "ola";
      }
    }
    validateNoCustom();
  });

  test("enabled, returns string", () => {
    class User {
      @gqlField()
      username(): string {
        return "ola";
      }
    }

    validateOneCustomField({
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
    validateNoCustomArgs();
  });

  test("enabled, returns int", () => {
    class User {
      @gqlField({ type: GraphQLInt })
      age(): number {
        return 32;
      }
    }

    validateOneCustomField({
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
    validateNoCustomArgs();
  });

  test("enabled, returns float", () => {
    class User {
      @gqlField({ type: GraphQLFloat })
      pi(): number {
        return 3.14;
      }
    }

    validateOneCustomField({
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
    validateNoCustomArgs();
  });

  test("enabled, returns float for implicit return type", () => {
    class User {
      @gqlField({ type: GraphQLFloat })
      pi() {
        return 3.14;
      }
    }

    validateOneCustomField({
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
    validateNoCustomArgs();
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
      expect(err.message).toMatch(/^Function isn't a valid type/);
    }
    validateNoCustom();
  });

  test("enabled, one param", () => {
    class User {
      @gqlField({ type: GraphQLInt })
      add(@gqlArg("id", { type: GraphQLInt }) base: number): number {
        return 1 + base;
      }
    }

    validateOneCustomField({
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
    validateNoCustomArgs();
  });

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

    validateOneCustomField({
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
    validateNoCustomArgs();
  });

  test("enabled, no arg decorator", () => {
    try {
      class User {
        @gqlField()
        find(pos: number, @gqlArg("cursor") cursor: string): string {
          return `${cursor}:${pos}`;
        }
      }
      fail("should not get here");
    } catch (e) {
      expect(e.message).toBe("args were not captured correctly");
    }
    validateNoCustom();
  });

  test("enabled. arg class", () => {
    // TODO need to ensure no params for these since not valid graphql i believe
    @gqlArgType()
    class SearchArgs {
      @gqlField()
      startCursor: string;

      @gqlField({ type: GraphQLInt, nullable: true })
      start: number;
    }
    class User {
      // search to return count
      // TODO need
      @gqlField({ type: GraphQLInt })
      search(@gqlArg("searchArgs") arg: SearchArgs): number {
        return 0;
      }
    }

    validateCustomFields([
      {
        nodeName: "SearchArgs",
        functionName: "startCursor",
        gqlName: "startCursor",
        results: [
          {
            type: "String",
            name: "",
          },
        ],
        args: [],
      },
      {
        nodeName: "SearchArgs",
        functionName: "start",
        gqlName: "start",
        results: [
          {
            type: "Int",
            name: "",
          },
        ],
        args: [],
      },
      {
        nodeName: "User",
        functionName: "search",
        gqlName: "search",
        args: [
          {
            type: "SearchArgs",
            name: "searchArgs",
            needsResolving: true,
          },
        ],
        results: [
          {
            type: "Int",
            name: "",
          },
        ],
      },
    ]);
    validateCustomArgs([
      {
        nodeName: "SearchArgs",
        className: "SearchArgs",
      },
    ]);
  });
});
