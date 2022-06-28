import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { GraphQLJSON, GraphQLJSONObject } from "graphql-type-json";
import { expectQueryFromRoot } from "../../testutils/ent-graphql-tests";

const val = {
  foo: "foo",
  bar: "bar",
  baz: "baz",
  cols: [1, 2, 3],
};

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "RootQueryType",
    fields: {
      hello: {
        type: GraphQLString,
        resolve() {
          return "world";
        },
      },
      json: {
        type: GraphQLJSON,
        resolve() {
          return val;
        },
      },
      list: {
        type: GraphQLJSON,
        resolve() {
          return [1, 2, 3];
        },
      },
      jsonObject: {
        type: GraphQLJSONObject,
        resolve() {
          return val;
        },
      },
      jsonObjectList: {
        type: GraphQLJSONObject,
        resolve() {
          return [1, 2, 3];
        },
      },
    },
  }),
});

test("json", async () => {
  await expectQueryFromRoot(
    {
      schema: schema,
      root: "json",
      args: {},
    },
    [
      ".",
      function (expVal) {
        expect(val).toEqual(expVal);
      },
    ],
  );
});

test("list", async () => {
  await expectQueryFromRoot(
    {
      schema: schema,
      root: "list",
      args: {},
    },
    [".", [1, 2, 3]],
  );
});

test("jsonObject", async () => {
  await expectQueryFromRoot(
    {
      schema: schema,
      root: "jsonObject",
      args: {},
    },
    [
      ".",
      function (expVal) {
        expect(val).toEqual(expVal);
      },
    ],
  );
});

test("jsonObjectList", async () => {
  await expectQueryFromRoot(
    {
      schema: schema,
      root: "jsonObjectList",
      args: {},
    },
    [
      ".",
      function (expVal) {
        // doesn't resolve
        expect(expVal).toBeNull();
      },
    ],
  );
});
