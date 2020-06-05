import {
  gqlField,
  gqlArg,
  GQLCapture,
  CustomField,
  gqlArgType,
  Field,
  CustomArg,
  CustomFieldType,
} from "./graphql";
import { GraphQLInt, GraphQLFloat, GraphQLString } from "graphql";

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
    expect(customField.fieldType).toBe(expectedCustomField.fieldType);

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
    expect(field.nullable).toBe(expField.nullable);
  }
}

function validateNoCustomFields() {
  expect(GQLCapture.getCustomFields().length).toBe(0);
}

function validateCustomArgs(expected: CustomArg[]) {
  let args = GQLCapture.getCustomArgs();
  expect(args.size).toBe(expected.length);

  for (let i = 0; i < expected.length; i++) {
    let expectedArg = expected[i];
    let arg = args.get(expectedArg.className);
    expect(arg).not.toBe(undefined);
    //    let arg = args[i];

    expect(arg!.className).toBe(expectedArg.className);
    expect(arg!.nodeName).toBe(expectedArg.nodeName);
  }
}
function validateNoCustomArgs() {
  expect(GQLCapture.getCustomArgs().size).toBe(0);
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
      fieldType: CustomFieldType.Accessor,
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

  test("enabled. nullable string", () => {
    class User {
      @gqlField({
        type: GraphQLString,
        nullable: true,
        description: "first + last name",
      })
      // boo when it's nullable, we need to indicate type and nullable: true
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
      fieldType: CustomFieldType.Accessor,
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
      fieldType: CustomFieldType.Accessor,
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
      fieldType: CustomFieldType.Accessor,
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
      fieldType: CustomFieldType.Accessor,
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

  test("enabled. list of strings", () => {
    class User {
      @gqlField({ type: [String] })
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
    validateNoCustomArgs();
  });

  test("enabled. list of strings", () => {
    class User {
      @gqlField({ type: [String] })
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
    validateNoCustomArgs();
  });

  test("enabled. nullable list of strings", () => {
    class User {
      @gqlField({ type: [String], nullable: true })
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
    validateNoCustomArgs();
  });

  test("enabled. nullable contents of strings", () => {
    class User {
      @gqlField({ type: [String], nullable: "contents" })
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
    validateNoCustomArgs();
  });

  test("enabled. nullable contents and list of strings", () => {
    class User {
      // all nullable
      @gqlField({ type: [String], nullable: "contentsAndList" })
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
    validateNoCustomArgs();
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
      fieldType: CustomFieldType.Field,
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
      fieldType: CustomFieldType.Field,
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
      fieldType: CustomFieldType.Field,
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
      fieldType: CustomFieldType.Field,
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
      fieldType: CustomFieldType.Function,
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
      fieldType: CustomFieldType.Function,
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
      fieldType: CustomFieldType.Function,
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
      fieldType: CustomFieldType.Function,
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
      add(@gqlArg("base", { type: GraphQLInt }) base: number): number {
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
    validateNoCustomArgs();
  });

  test("enabled, nullable arg", () => {
    class User {
      @gqlField({ name: "find" })
      findFromPos(
        @gqlArg("pos", { type: GraphQLInt, nullable: true })
        pos: number,
      ): string {
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

      @gqlField({ type: GraphQLInt })
      start: number;

      @gqlField({ type: GraphQLInt, nullable: true })
      end: number;
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
  });

  test("enabled. referencing non-arg class", () => {
    try {
      class SearchArgs {
        startCursor: string;

        start: number;

        end: number;
      }
      class User {
        @gqlField({ type: GraphQLInt })
        search(@gqlArg("searchArgs") arg: SearchArgs): number {
          return 0;
        }
      }
    } catch (error) {
      // TODO need a better message here
      expect(error.message).toMatch("args were not captured correctly");
    }
  });

  test("enabled. resolve return types", () => {
    // graphql object
    class Contact {}

    class User {
      @gqlField({ type: Contact })
      selfContact(): Contact {
        return new Contact();
      }
    }

    expect(GQLCapture.getCustomArgs().size).toBe(0);
    expect(GQLCapture.getCustomFields().length).toBe(1);
    // no errors!
    GQLCapture.resolve(["User", "Contact"]);
  });

  test("enabled. resolve return types", () => {
    // graphql object
    class Contact {}

    class User {
      @gqlField({ type: Contact })
      selfContact(): Contact {
        return new Contact();
      }
    }

    expect(GQLCapture.getCustomArgs().size).toBe(0);
    expect(GQLCapture.getCustomFields().length).toBe(1);
    try {
      GQLCapture.resolve(["User"]);
      fail("shouldn't get here");
    } catch (error) {
      expect(error.message).toMatch(/^field selfContact references Contact/);
    }
  });

  test("enabled. async response", () => {
    try {
      class User {
        @gqlField({})
        async load(): Promise<User> {
          return new User();
        }
      }
      fail("shouldn't have gotten here");
    } catch (e) {
      expect(e.message).toMatch(/^Promise isn't a valid type/);
    }
    validateNoCustom();
  });

  test("enabled. async response with type hint", () => {
    class User {
      @gqlField({ type: User, name: "self" })
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
    validateNoCustomArgs();
  });

  test("enabled. implied async response with type hint", () => {
    class User {
      @gqlField({ type: User, name: "self" })
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
    validateNoCustomArgs();
  });

  test("enabled. object type string because 'circular dependencies'", () => {
    class User {
      @gqlField({ type: "User", name: "self" })
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
    validateNoCustomArgs();
  });

  test("enabled. object type string list because 'circular dependencies'", () => {
    class User {
      @gqlField({ type: "[User]", name: "self" })
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
    validateNoCustomArgs();
  });
});
