import {
  buildSchema,
  GraphQLInputObjectType,
  parseValue,
  valueFromAST,
} from "graphql";
import { clearGlobalSchema, setGlobalSchema } from "../core/global_schema";
import { StringType, TimestampType } from "./field";
import { StructType, StructTypeAsList } from "./struct_field";
import { UnionType } from "./union_field";

const schema = buildSchema(`
  input DetailInput { displayName: String! }
  input ProfileInput {
    detail: DetailInput!
    contacts: [DetailInput!]!
  }
  type Query { unused: Boolean }
`);

function literal(source: string, type = "DetailInput") {
  return valueFromAST(
    parseValue(source),
    schema.getType(type) as GraphQLInputObjectType,
  ) as Record<string, any>;
}

function detail() {
  return StructType({
    tsType: "Detail",
    fields: { displayName: StringType({ minLen: 2, toUpperCase: true }) },
  });
}

test.each([
  "literal",
  "variable",
])("nested struct/list %s input", async (kind) => {
  const f = StructType({
    tsType: "Profile",
    fields: {
      detail: detail(),
      contacts: StructTypeAsList({
        tsType: "Contacts",
        fields: detail().type.subFields!,
        validateUniqueKey: "displayName",
      }),
    },
  });
  const input =
    kind === "literal"
      ? literal(
          '{detail: {displayName: "alice"}, contacts: [{displayName: "bob"}]}',
          "ProfileInput",
        )
      : JSON.parse(
          '{"detail":{"displayName":"alice"},"contacts":[{"displayName":"bob"}]}',
        );
  const prototype = kind === "literal" ? null : Object.prototype;
  expect(Object.getPrototypeOf(input.detail)).toBe(prototype);
  expect(Object.getPrototypeOf(input.contacts[0])).toBe(prototype);
  expect(await f.valid(input)).toBe(true);
  const expected = {
    detail: { display_name: "ALICE" },
    contacts: [{ display_name: "BOB" }],
  };
  expect(f.format(input)).toBe(JSON.stringify(expected));
  expect(f.format(input, true)).toStrictEqual(expected);
  expect(Object.getPrototypeOf(input.detail)).toBe(prototype);
  expect(input.detail.displayName).toBe("alice");
  input.contacts.push(input.contacts[0]);
  expect(await f.valid(input)).toBe(false);
});

test("global structs adapt literal records between scalar and list fields", async () => {
  setGlobalSchema({
    fields: {
      detail: detail(),
      details: StructTypeAsList({
        tsType: "Details",
        fields: detail().type.subFields!,
      }),
    },
  });
  try {
    for (const globalType of ["Detail", "Details"]) {
      const input = literal('{displayName: "alice"}');
      const scalar = StructType({ globalType });
      expect(await scalar.valid(input)).toBe(true);
      expect(scalar.format(input)).toBe('{"display_name":"ALICE"}');
      const list = StructTypeAsList({ globalType });
      expect(await list.valid([input])).toBe(true);
      expect(list.format([input])).toBe('[{"display_name":"ALICE"}]');
    }
  } finally {
    clearGlobalSchema();
  }
});

test("nested union accepts literal records and still requires one valid member", async () => {
  const union = UnionType({
    tsType: "Contact",
    fields: {
      person: detail(),
      organization: StructType({
        tsType: "Organization",
        fields: { company: StringType() },
      }),
    },
  });
  const f = StructType({ tsType: "Wrapper", fields: { contact: union } });
  const contact = literal('{displayName: "alice"}');
  const input = Object.assign(Object.create(null), { contact });
  expect(await f.valid(input)).toBe(true);
  expect(f.format(input)).toBe('{"contact":{"display_name":"ALICE"}}');
  expect(Object.getPrototypeOf(contact)).toBe(null);
  expect(Object.keys(contact)).toEqual(["displayName"]);
  expect(await union.valid(literal('{displayName: "a"}'))).toBe(false);
  contact.company = "Acme";
  expect(await union.valid(contact)).toBe(false);
});

test("invalid literal records still fail their field validators", async () => {
  expect(await detail().valid(literal('{displayName: "a"}'))).toBe(false);
  expect(await detail().valid(Object.create(null))).toBe(false);
  const failure = new Error("field validator failed");
  const f = StructType({
    tsType: "Throwing",
    fields: {
      displayName: Object.assign(StringType(), {
        valid: () => {
          throw failure;
        },
      }),
    },
  });
  await expect(f.valid(literal('{displayName: "alice"}'))).rejects.toBe(
    failure,
  );
});

test.each([
  undefined,
  null,
  false,
  1,
  "text",
  Symbol("value"),
  [],
  [1],
  () => {},
])("rejects non-record input %p even with only nullable fields", async (input) => {
  const f = StructType({
    tsType: "Optional",
    fields: { name: StringType({ nullable: true }) },
  });
  const union = UnionType({ tsType: "OptionalUnion", fields: { optional: f } });
  const list = StructTypeAsList({
    tsType: "OptionalList",
    fields: f.type.subFields!,
  });
  expect(await f.valid(input)).toBe(false);
  expect(() => f.format(input)).toThrow("valid was not called");
  expect(await union.valid(input)).toBe(false);
  expect(() => union.format(input)).toThrow("valid was not called");
  expect(await list.valid([input])).toBe(false);
  if (!Array.isArray(input)) {
    expect(await list.valid(input)).toBe(false);
  }
});

test("class instances and nested Dates retain their identity", async () => {
  class Detail {
    displayName = "alice";
  }
  const value = new Detail();
  const date = new Date("2026-01-02T00:00:00.000Z");
  const validate = jest.fn((input) => input === date);
  const f = StructType({
    tsType: "WithDate",
    fields: {
      detail: detail(),
      at: TimestampType({ valid: validate }),
    },
  });
  const input = { detail: value, at: date };
  expect(await f.valid(input)).toBe(true);
  expect(validate).toHaveBeenCalledWith(date);
  expect(f.format(input)).toBe(
    '{"detail":{"display_name":"ALICE"},"at":"2026-01-02T00:00:00.000Z"}',
  );
  expect(input.detail).toBe(value);
  expect(input.detail).toBeInstanceOf(Detail);
  expect(input.at).toBe(date);
});
