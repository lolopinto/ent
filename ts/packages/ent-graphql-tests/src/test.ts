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
import { resolve } from "path";

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

interface Address {
  id: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  apartment?: string | null;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  address?: Address | null;
}

function getUser(id: string): User {
  let result: User = {
    id,
    firstName: "Jon",
    lastName: "Snow",
  };

  let num = parseInt(id, 0) || 0;
  if (num % 2 == 0) {
    result.address = {
      id: "23",
      street: "1 main street",
      city: "San Francisco",
      state: "CA",
      zipCode: "94102",
    };
  }
  return result;
}

function editUser(id: string, user: Partial<User>): User {
  return {
    ...getUser(id),
    ...user,
  };
}

let addressType = new GraphQLObjectType({
  name: "Address",
  fields: {
    id: {
      type: GraphQLNonNull(GraphQLID),
    },
    street: {
      type: GraphQLNonNull(GraphQLString),
    },
    city: {
      type: GraphQLNonNull(GraphQLString),
    },
    state: {
      type: GraphQLNonNull(GraphQLString),
    },
    zipCode: {
      type: GraphQLNonNull(GraphQLString),
    },
    apartment: {
      type: GraphQLString,
    },
  },
});

let userType = new GraphQLObjectType({
  name: "User",
  fields: {
    id: {
      type: GraphQLNonNull(GraphQLID),
    },
    firstName: {
      type: GraphQLString,
    },
    lastName: {
      type: GraphQLString,
    },
    address: {
      type: addressType,
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

describe("query with args", () => {
  let schema = new GraphQLSchema({
    query: rootQuery,
  });

  test("simple. no nulls", async () => {
    let cfg: queryRootConfig = {
      schema: schema,
      args: {
        id: "1",
      },
      root: "user",
    };

    await expectQueryFromRoot(
      cfg,
      ["id", "1"],
      ["firstName", "Jon"],
      ["lastName", "Snow"],
    );
  });

  test("with nullable root paths", async () => {
    let cfg: queryRootConfig = {
      schema: schema,
      args: {
        id: "1",
      },
      nullQueryPaths: ["address"],
      root: "user",
    };

    await expectQueryFromRoot(cfg, ["id", "1"], ["address.id", null]);
  });

  test("with nullable sub-parts", async () => {
    let cfg: queryRootConfig = {
      schema: schema,
      args: {
        id: "2",
      },
      root: "user",
    };

    await expectQueryFromRoot(
      cfg,
      ["id", "2"],
      ["firstName", "Jon"],
      ["lastName", "Snow"],
      ["address.id", "23"],
      ["address.street", "1 main street"],
      ["address.state", "CA"],
      ["address.zipCode", "94102"],
      ["address.apartment", null],
    );
  });
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

test("with async callback", async () => {
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

  await expectQueryFromRoot(
    cfg,
    ["id", "1"],
    ["firstName", "Jon"],
    [
      "lastName",
      async (arg) => {
        await new Promise((resolve, reject) => {
          setTimeout(() => resolve(), 10);
        });
      },
    ],
  );
});
