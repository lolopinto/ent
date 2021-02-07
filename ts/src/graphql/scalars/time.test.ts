import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
} from "graphql";
import { expectMutation } from "../../testutils/ent-graphql-tests";
import { GraphQLTime } from "./time";
import { DateTime } from "luxon";

let schema = new GraphQLSchema({
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
      logEvent: {
        type: GraphQLNonNull(GraphQLTime),
        args: {
          time: {
            type: GraphQLNonNull(GraphQLTime),
          },
          event: {
            type: GraphQLNonNull(GraphQLString),
          },
        },
        resolve(_, args) {
          return args.time;
        },
      },
    },
  }),
});

describe("date", () => {
  const dt = DateTime.fromISO("2021-01-20");
  const expValue = dt.toUTC().toISO();

  test("mm-dd-yy format", async () => {
    await expectMutation(
      {
        mutation: "logEvent",
        disableInputWrapping: true,
        args: {
          time: "2021-01-20",
          event: "inauguaration",
        },
        schema,
      },
      [".", expValue],
    );
  });

  test("ms", async () => {
    await expectMutation(
      {
        mutation: "logEvent",
        disableInputWrapping: true,
        args: {
          time: dt.toMillis(),
          event: "inauguaration",
        },
        schema,
      },
      [".", expValue],
    );
  });

  test("words", async () => {
    DateTime.fromISO;
    await expectMutation(
      {
        mutation: "logEvent",
        disableInputWrapping: true,
        args: {
          time: "January 20, 2021",
          event: "inauguaration",
        },
        schema,
      },
      [".", expValue],
    );
  });
});

describe("timestamp", () => {
  const sb2021 = DateTime.fromJSDate(new Date(2021, 1, 6, 15, 30, 0, 0), {
    zone: "America/Los_Angeles",
  });
  const expValue = sb2021.toUTC().toISO();

  test("ms", async () => {
    await expectMutation(
      {
        mutation: "logEvent",
        disableInputWrapping: true,
        args: {
          time: sb2021.toMillis(),
          event: "SB 2021",
        },
        schema,
      },
      [".", expValue],
    );
  });

  test("iso 8601", async () => {
    await expectMutation(
      {
        mutation: "logEvent",
        disableInputWrapping: true,
        args: {
          time: sb2021.toISO(),
          event: "SB 2021",
        },
        schema,
      },
      [".", expValue],
    );
  });
});
