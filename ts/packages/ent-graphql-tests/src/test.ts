import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLID,
} from "graphql";

import {
  queryRootConfig,
  mutationRootConfig,
  expectQueryFromRoot,
  expectMutation,
} from "./index";

test("simplest query", async () => {
  let schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "RootQueryType",
      fields: {
        hello: {
          type: GraphQLString,
          resolve() {
            return "world";
          },
        },
      },
    }),
  });

  let cfg: queryRootConfig = {
    schema: schema,
    args: {},
    root: "hello",
  };

  // root query
  await expectQueryFromRoot(cfg, ["", "world"]);
});

interface User {
  id: string;
  firstName: string;
  lastName: string;
}

function getUser(id: string): User {
  return {
    id,
    firstName: "Jon",
    lastName: "Snow",
  };
}

function editUser(id: string, user: Partial<User>): User {
  return {
    ...getUser(id),
    ...user,
  };
}

let userType = new GraphQLObjectType({
  name: "User",
  fields: {
    id: {
      type: GraphQLString,
    },
    firstName: {
      type: GraphQLString,
    },
    lastName: {
      type: GraphQLString,
    },
  },
});

let rootQuery = new GraphQLObjectType({
  name: "RootQueryType",
  fields: {
    user: {
      args: {
        id: {
          type: GraphQLNonNull(GraphQLID),
        },
      },
      type: userType,
      resolve(_source, { id }) {
        return getUser(id);
      },
    },
  },
});

test("query with args", async () => {
  let schema = new GraphQLSchema({
    query: rootQuery,
  });

  let cfg: queryRootConfig = {
    schema: schema,
    args: {
      id: "1",
    },
    root: "user",
  };

  // root query
  await expectQueryFromRoot(
    cfg,
    ["id", "1"],
    ["firstName", "Jon"],
    ["lastName", "Snow"],
  );
});

test("mutation with args", async () => {
  let schema = new GraphQLSchema({
    query: rootQuery,
    mutation: new GraphQLObjectType({
      name: "RootMutationType",
      fields: {
        userEdit: {
          args: {
            id: {
              type: GraphQLNonNull(GraphQLID),
            },
            firstName: {
              type: GraphQLString,
            },
            lastName: {
              type: GraphQLString,
            },
          },
          type: userType,
          resolve(_source, { id, ...args }) {
            return editUser(id, args);
          },
        },
      },
    }),
  });

  let cfg: mutationRootConfig = {
    schema: schema,
    args: {
      id: "1",
      firstName: "Aegon",
      lastName: "Targaryen",
    },
    mutation: "userEdit",
    disableInputWrapping: true,
  };

  // mutation query
  await expectMutation(
    cfg,
    ["id", "1"],
    ["firstName", "Aegon"],
    ["lastName", "Targaryen"],
  );
});
