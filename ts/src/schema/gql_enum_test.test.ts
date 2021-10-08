import {
  GraphQLEnumType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import { expectQueryFromRoot } from "../testutils/ent-graphql-tests/";

// TODO come back here
const FailedLangType = new GraphQLEnumType({
  name: "failedLang",
  values: {
    C_PLUS_PLUS: {
      value: "C++",
      // not a valid value
    },
    C_SHARP: {
      value: "C#",
    },
  },
});

const LangType = new GraphQLEnumType({
  name: "lang",
  values: {
    C_PLUS_PLUS: {
      value: "C_PLUS_PLUS",
    },
    C_SHARP: {
      value: "C_SHARP",
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
            type: GraphQLNonNull(FailedLangType),
          },
        },
        resolve: (lang) => {
          // why undefined
          return `${lang} world`;
        },
      },
      hello2: {
        type: GraphQLString,
        args: {
          lang: {
            type: GraphQLNonNull(LangType),
          },
        },
        resolve: (lang) => {
          console.debug(lang);
          return `${lang} world`;
        },
      },
    },
  }),
  //  types: [LangType],
});

test("failed value", async () => {
  await expectQueryFromRoot(
    {
      schema,
      args: {
        lang: "C#",
      },
      expectedError:
        'Variable "$lang" got invalid value "C#"; Value "C#" does not exist in "failedLang" enum.',
      debugMode: true,
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

test("correct value failed lang", async () => {
  await expectQueryFromRoot(
    {
      schema,
      args: {
        lang: "C_SHARP",
      },
      debugMode: true,
      root: "hello",
    },
    [
      ".",
      function (r) {
        console.debug(typeof r);
        expect(r).toEqual("undefined world");
      },
    ],
  );
});

test.only("correct value correct lang", async () => {
  await expectQueryFromRoot(
    {
      schema,
      args: {
        lang: "C_SHARP",
      },
      debugMode: true,
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
