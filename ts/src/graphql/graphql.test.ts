import {
  gqlField,
  GQLCapture,
  gqlArgType,
  CustomFieldType,
  gqlConnection,
} from "./graphql";
import {
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLScalarType,
  GraphQLError,
} from "graphql";
import { Kind, ValueNode } from "graphql/language";

import {
  validateOneCustomField,
  CustomObjectTypes,
  validateCustomFields,
  validateNoCustom,
  validateCustomArgs,
  validateCustomTypes,
} from "./graphql_field_helpers";

beforeEach(() => {
  GQLCapture.clear();
  GQLCapture.enable(true);
});

describe("accessor", () => {
  test("disabled", () => {
    GQLCapture.enable(false);
    class User {
      @gqlField({
        class: "User",
        type: GraphQLString,
      })
      get fullName(): string {
        return "fullName";
      }
    }
    validateNoCustom();
  });

  test("enabled. string", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLString,
      })
      get fullName(): string {
        return "fullName";
      }
    }

    validateOneCustomField({
      nodeName: "User",
      functionName: "fullName",
      gqlName: "fullName",
      fieldType: CustomFieldType.Accessor,
      results: [
        {
          type: "String",
          name: "",
          tsType: "string",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. nullable string", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLString,
        nullable: true,
        description: "first + last name",
      })
      get fullName(): string | null {
        return "fullName";
      }
    }

    validateOneCustomField({
      nodeName: "User",
      functionName: "fullName",
      gqlName: "fullName",
      fieldType: CustomFieldType.Accessor,
      description: "first + last name",
      results: [
        {
          type: "String",
          name: "",
          nullable: true,
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. int", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLInt,
      })
      get age(): number {
        return 3.2;
      }
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      fieldType: CustomFieldType.Accessor,
      results: [
        {
          type: "Int",
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. float", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLFloat,
      })
      get age(): number {
        return 3.2;
      }
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      fieldType: CustomFieldType.Accessor,
      results: [
        {
          type: "Float",
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. returns float with implicit number", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLFloat,
      })
      get age() {
        return 3.2;
      }
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      fieldType: CustomFieldType.Accessor,
      results: [
        {
          type: "Float",
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. returns int with implicit number", () => {
    class User {
      @gqlField({ class: "User", type: GraphQLInt })
      get age() {
        return 3.2;
      }
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      fieldType: CustomFieldType.Accessor,
      results: [
        {
          type: "Int",
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. list of strings", () => {
    class User {
      @gqlField({
        class: "User",
        type: [String],
      })
      get names(): string[] {
        return ["firstName", "lastName", "fullName"];
      }
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "names",
      gqlName: "names",
      fieldType: CustomFieldType.Accessor,
      results: [
        {
          type: "String",
          list: true,
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. nullable list of strings", () => {
    class User {
      @gqlField({
        class: "User",
        type: [String],
        nullable: true,
      })
      get names(): string[] | null {
        return null;
      }
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "names",
      gqlName: "names",
      fieldType: CustomFieldType.Accessor,
      results: [
        {
          type: "String",
          list: true,
          nullable: true,
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. nullable contents of strings", () => {
    class User {
      @gqlField({
        class: "User",
        type: [String],
        nullable: "contents",
      })
      get names(): (string | null)[] {
        return ["firstName", "lastName", "fullName", null];
      }
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "names",
      gqlName: "names",
      fieldType: CustomFieldType.Accessor,
      results: [
        {
          type: "String",
          list: true,
          name: "",
          nullable: "contents",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. nullable contents and list of strings", () => {
    class User {
      // all nullable
      @gqlField({
        class: "User",
        type: [String],
        nullable: "contentsAndList",
      })
      get names(): (string | null)[] | null {
        return null;
      }
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "names",
      gqlName: "names",
      fieldType: CustomFieldType.Accessor,
      results: [
        {
          type: "String",
          list: true,
          name: "",
          nullable: "contentsAndList",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });
});

describe("property", () => {
  test("disabled", () => {
    GQLCapture.enable(false);
    class User {
      @gqlField({
        class: "User",
        type: GraphQLString,
      })
      fullName: string;
    }
    validateNoCustom();
  });

  test("enabled. string", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLString,
      })
      fullName: string;
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "fullName",
      gqlName: "fullName",
      fieldType: CustomFieldType.Field,
      results: [
        {
          type: "String",
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. int", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLInt,
      })
      age: number;
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      fieldType: CustomFieldType.Field,
      results: [
        {
          type: "Int",
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. float", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLFloat,
      })
      age: number;
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      fieldType: CustomFieldType.Field,
      results: [
        {
          type: "Float",
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. with implicit type. explicit graphql type", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLFloat,
      })
      // lol but why?
      age;
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      fieldType: CustomFieldType.Field,
      results: [
        {
          type: "Float",
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  describe("enabled. custom scalar", () => {
    class Point {
      constructor(private x: number, private y: number) {}

      serialize(): string {
        return `${this.x},${this.y}`;
      }
    }

    const GraphQLPoint = new GraphQLScalarType({
      name: "Point",
      description: "Point scalar type",
      serialize: (outputValue: Point) => {
        return outputValue.serialize();
      },
      parseValue: (input: any) => {
        if (typeof input !== "string") {
          throw new GraphQLError(`invalid input value ${input}`);
        }
        const parts = input.split(",");
        if (parts.length !== 2) {
          throw new GraphQLError(`invalid input value ${input}`);
        }
        return new Point(parseInt(parts[0], 10), parseInt(parts[1], 10));
      },
      parseLiteral: (ast: ValueNode) => {
        if (ast.kind === Kind.STRING) {
          const parts = ast.value.split(",");
          if (parts.length !== 2) {
            throw new GraphQLError(`invalid input value ${ast.value}`);
          }
          return new Point(parseInt(parts[0], 10), parseInt(parts[1], 10));
        }
        throw new GraphQLError(`Time cannot represent literal value ${ast}`);
      },
    });

    test("enabled. custom scalar used incorrectly", () => {
      try {
        class User {
          @gqlField({
            class: "User",
            type: GraphQLPoint,
          })
          point: Point;
        }
        throw new Error("should not get here");
      } catch (e) {
        expect(e.message).toMatch(
          /custom scalar type Point is not supported this way. use CustomType syntax/,
        );
      }

      validateNoCustom();
    });

    test("enabled. custom scalar used correctly", () => {
      class User {
        @gqlField({
          class: "User",
          type: {
            type: "GraphQLPoint",
            importPath: "",
            tsType: "Point",
            tsImportPath: "",
          },
        })
        point: Point;
      }

      validateOneCustomField({
        nodeName: "User",
        functionName: "point",
        gqlName: "point",
        fieldType: CustomFieldType.Field,
        results: [
          {
            type: "GraphQLPoint",
            name: "",
            tsType: "Point",
            needsResolving: true,
          },
        ],
        args: [],
      });

      validateCustomTypes([
        {
          type: "GraphQLPoint",
          importPath: "",
          tsType: "Point",
          tsImportPath: "",
        },
      ]);
    });
  });
});

describe("function", () => {
  test("disabled", () => {
    GQLCapture.enable(false);
    class User {
      @gqlField({
        class: "User",
        type: GraphQLString,
      })
      username(): string {
        return "ola";
      }
    }
    validateNoCustom();
  });

  test("enabled, returns string", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLString,
      })
      username(): string {
        return "ola";
      }
    }

    validateOneCustomField({
      nodeName: "User",
      functionName: "username",
      gqlName: "username",
      fieldType: CustomFieldType.Function,
      results: [
        {
          type: "String",
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled, returns int", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLInt,
      })
      age(): number {
        return 32;
      }
    }

    validateOneCustomField({
      nodeName: "User",
      functionName: "age",
      gqlName: "age",
      fieldType: CustomFieldType.Function,
      results: [
        {
          type: "Int",
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled, returns float", () => {
    class User {
      @gqlField({ class: "User", type: GraphQLFloat })
      pi(): number {
        return 3.14;
      }
    }

    validateOneCustomField({
      nodeName: "User",
      functionName: "pi",
      gqlName: "pi",
      fieldType: CustomFieldType.Function,
      results: [
        {
          type: "Float",
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled, returns float. implicit return type", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLFloat,
      })
      pi() {
        return 3.14;
      }
    }

    validateOneCustomField({
      nodeName: "User",
      functionName: "pi",
      gqlName: "pi",
      fieldType: CustomFieldType.Function,
      results: [
        {
          type: "Float",
          name: "",
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled, one param", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLInt,
        args: [
          {
            name: "base",
            type: GraphQLInt,
          },
        ],
      })
      add(base: number): number {
        return 1 + base;
      }
    }

    validateOneCustomField({
      nodeName: "User",
      functionName: "add",
      gqlName: "add",
      fieldType: CustomFieldType.Function,
      results: [
        {
          type: "Int",
          name: "",
        },
      ],
      args: [
        {
          type: "Int",
          name: "base",
        },
      ],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled, multiple param", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLString,
        args: [
          {
            name: "pos",
            type: GraphQLInt,
          },
          {
            name: "cursor",
            type: GraphQLString,
          },
        ],
      })
      find(pos: number, cursor: string): string {
        return `${cursor}:${pos}`;
      }
    }

    validateOneCustomField({
      nodeName: "User",
      functionName: "find",
      gqlName: "find",
      fieldType: CustomFieldType.Function,
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
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled, nullable arg", () => {
    class User {
      @gqlField({
        class: "User",
        type: GraphQLString,
        name: "find",
        args: [
          {
            name: "pos",
            type: GraphQLInt,
            nullable: true,
          },
        ],
      })
      findFromPos(pos: number): string {
        return `${pos}`;
      }
    }

    validateOneCustomField({
      nodeName: "User",
      functionName: "findFromPos",
      gqlName: "find",
      fieldType: CustomFieldType.Function,
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
          nullable: true,
        },
      ],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. arg class", () => {
    // TODO need to ensure no params for these since not valid graphql i believe
    @gqlArgType()
    class SearchArgs {
      @gqlField({
        class: "SearchArgs",
        type: GraphQLString,
      })
      startCursor: string;

      @gqlField({
        class: "SearchArgs",
        type: GraphQLInt,
      })
      start: number;

      @gqlField({
        class: "SearchArgs",
        type: GraphQLInt,
        nullable: true,
      })
      end: number;
    }
    class User {
      // search to return count
      // TODO need
      @gqlField({
        class: "User",
        type: GraphQLInt,
        args: [
          {
            name: "searchArgs",
            type: SearchArgs,
          },
        ],
      })
      search(arg: SearchArgs): number {
        return 0;
      }
    }

    validateCustomFields([
      {
        nodeName: "SearchArgs",
        functionName: "startCursor",
        gqlName: "startCursor",
        fieldType: CustomFieldType.Field,
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
        fieldType: CustomFieldType.Field,

        results: [
          {
            type: "Int",
            name: "",
          },
        ],
        args: [],
      },
      {
        nodeName: "SearchArgs",
        functionName: "end",
        gqlName: "end",
        fieldType: CustomFieldType.Field,

        results: [
          {
            type: "Int",
            name: "",
            nullable: true,
          },
        ],
        args: [],
      },
      {
        nodeName: "User",
        functionName: "search",
        gqlName: "search",
        fieldType: CustomFieldType.Function,
        args: [
          {
            type: "SearchArgs",
            name: "searchArgs",
            needsResolving: true, // TODO do we still need this?
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
    validateNoCustom(CustomObjectTypes.Field, CustomObjectTypes.Arg);
  });

  test("enabled. referencing non-arg class", () => {
    try {
      class SearchArgs {
        startCursor: string;

        start: number;

        end: number;
      }
      class User {
        @gqlField({
          class: "User",
          type: GraphQLInt,
          args: [{ name: "searchArgs", type: SearchArgs }],
        })
        search(arg: SearchArgs): number {
          return 0;
        }
      }
      GQLCapture.resolve([]);
      throw new Error("should throw");
    } catch (error) {
      // TODO need a better message here
      expect(error.message).toMatch(
        /arg searchArgs of field search with type SearchArgs needs resolving. should not be possible/,
      );
    }
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. resolve return types", () => {
    // graphql object
    class Contact {}

    class User {
      @gqlField({ class: "User", type: Contact })
      selfContact(): Contact {
        return new Contact();
      }
    }

    expect(GQLCapture.getCustomArgs().size).toBe(0);
    expect(GQLCapture.getCustomFields().size).toBe(1);
    // no errors!
    GQLCapture.resolve(["User", "Contact"]);
  });

  test("enabled. resolve return types", () => {
    // graphql object
    class Contact {}

    class User {
      @gqlField({
        class: "User",
        type: Contact,
      })
      selfContact(): Contact {
        return new Contact();
      }
    }

    validateNoCustom(CustomObjectTypes.Field);
    try {
      GQLCapture.resolve(["User"]);
      throw new Error("shouldn't get here");
    } catch (error) {
      expect(error.message).toMatch(/^field selfContact references Contact/);
    }
  });

  // these next two are 'User' because of circular dependencies
  test("enabled. async response with type hint", () => {
    class User {
      @gqlField({
        class: "User",
        type: "User",
        name: "self",
        async: true,
      })
      async loadSelf(): Promise<User> {
        return new User();
      }
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "loadSelf",
      gqlName: "self",
      fieldType: CustomFieldType.AsyncFunction,
      results: [
        {
          type: "User",
          name: "",
          needsResolving: true,
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. implied async response with type hint", () => {
    class User {
      @gqlField({ class: "User", type: "User", name: "self", async: true })
      async loadSelf() {
        return new User();
      }
    }
    validateOneCustomField({
      nodeName: "User",
      functionName: "loadSelf",
      gqlName: "self",
      fieldType: CustomFieldType.AsyncFunction,
      results: [
        {
          type: "User",
          name: "",
          needsResolving: true,
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("enabled. object type string list because 'circular dependencies'", () => {
    class User {
      @gqlField({
        class: "User",
        type: "[User]",
        name: "self",
        async: true,
      })
      async loadSelf() {
        return [new User()];
      }
    }

    validateOneCustomField({
      nodeName: "User",
      functionName: "loadSelf",
      gqlName: "self",
      fieldType: CustomFieldType.AsyncFunction,
      results: [
        {
          type: "User",
          name: "",
          list: true,
          needsResolving: true,
        },
      ],
      args: [],
    });
    validateNoCustom(CustomObjectTypes.Field);
  });

  test("connection", async () => {
    class User {
      @gqlField({
        class: "User",
        type: gqlConnection("User"),
        name: "userToSelves",
      })
      loadSelves() {
        // ignore
        return [new User()];
      }
    }

    validateCustomFields([
      {
        nodeName: "User",
        functionName: "loadSelves",
        gqlName: "userToSelves",
        fieldType: CustomFieldType.Function,
        results: [
          {
            type: "User",
            name: "",
            connection: true,
            needsResolving: true,
          },
        ],
        args: [],
      },
    ]);

    validateNoCustom(CustomObjectTypes.Field);
  });

  test("connection with async", async () => {
    try {
      class User {
        @gqlField({
          class: "User",
          type: gqlConnection("User"),
          name: "userToSelves",
          async: true,
        })
        async loadSelves() {
          // ignore
          return [new User()];
        }
      }
      throw new Error("should have thrown");
    } catch (e) {
      expect(e.message).toBe(
        // TODO is this still true...
        "async function not currently supported for GraphQLConnection",
      );
    }

    validateNoCustom();
  });
});
