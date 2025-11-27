import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
} from "graphql";
import { expectMutation } from "../../testutils/ent-graphql-tests";
import { GraphQLDate } from "./date";

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "root",
    fields: {
      hello: {
        type: GraphQLString,
        resolve() {
          return "world";
        },
      },
    },
  }),
  mutation: new GraphQLObjectType({
    name: "mutation",
    fields: {
      setHoliday: {
        type: new GraphQLNonNull(GraphQLDate),
        args: {
          date: { type: new GraphQLNonNull(GraphQLDate) },
        },
        resolve(_, args) {
          return args.date;
        },
      },
    },
  }),
});

describe("GraphQLDate", () => {
  test("accepts YYYY-MM-DD", async () => {
    await expectMutation(
      {
        mutation: "setHoliday",
        disableInputWrapping: true,
        args: { date: "2021-01-20" },
        schema,
      },
      [".", "2021-01-20"],
    );
  });

  test("rejects timestamp", () => {
    expect(() => GraphQLDate.parseValue("2021-01-20T00:00:00Z")).toThrow(
      /YYYY-MM-DD/,
    );
  });
});
