import {
  GraphQLEnumType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import { expectQueryFromRoot } from "../testutils/ent-graphql-tests/";

const LangDifferentKVType = new GraphQLEnumType({
  name: "langDiffKV",
  values: {
    C_PLUS_PLUS: {
      value: "C++",
    },
    C_SHARP: {
      value: "C#",
    },
  },
});

const LangSameKVType = new GraphQLEnumType({
  name: "langSameKV",
  values: {
    C_PLUS_PLUS: {
      value: "C_PLUS_PLUS",
    },
    C_SHARP: {
      value: "C_SHARP",
    },
  },
});

const LangIntType = new GraphQLEnumType({
  name: "langInt",
  values: {
    C_PLUS_PLUS: {
      value: 0,
    },
    C_SHARP: {
      value: 1,
    },
  },
});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: {
      hello: {
        type: GraphQLString,
        args: {
          lang: {
            type: new GraphQLNonNull(LangDifferentKVType),
          },
        },
        resolve: (src, args) => {
          return `${args.lang} world`;
        },
      },
      hello2: {
        type: GraphQLString,
        args: {
          lang: {
            type: new GraphQLNonNull(LangSameKVType),
          },
        },
        resolve: (src, args) => {
          return `${args.lang} world`;
        },
      },
      hello3: {
        type: GraphQLString,
        args: {
          lang: {
            type: new GraphQLNonNull(LangIntType),
          },
        },
        resolve: (src, args) => {
          expect(typeof args.lang).toBe("number");
          return `${args.lang} world`;
        },
      },
    },
  }),
});

test("failed value", async () => {
  await expectQueryFromRoot(
    {
      schema,
      args: {
        lang: "C#",
      },
      expectedError:
        'Variable "$lang" got invalid value "C#"; Value "C#" does not exist in "langDiffKV" enum.',
      root: "hello",
    },
    [
      ".",
      function (r) {
        console.log(r);
      },
    ],
  );
});

test("different key and value", async () => {
  await expectQueryFromRoot(
    {
      schema,
      args: {
        lang: "C_SHARP",
      },
      root: "hello",
    },
    [
      ".",
      function (r) {
        expect(r).toBe("C# world");
      },
    ],
  );
});

test("same key and value", async () => {
  await expectQueryFromRoot(
    {
      schema,
      args: {
        lang: "C_SHARP",
      },
      root: "hello2",
    },
    [
      ".",
      function (r) {
        expect(r).toBe("C_SHARP world");
      },
    ],
  );
});

test("string key and int value", async () => {
  await expectQueryFromRoot(
    {
      schema,
      args: {
        lang: "C_SHARP",
      },
      root: "hello3",
    },
    [
      ".",
      function (r) {
        expect(r).toBe("1 world");
      },
    ],
  );
});
