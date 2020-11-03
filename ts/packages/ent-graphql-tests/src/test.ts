import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLID,
  GraphQLList,
  GraphQLInt,
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
  contacts?({ first: number }): Contact[];
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  phoneNumber: string;
}

export const names: Partial<Pick<Contact, "firstName" | "lastName">>[] = [
  {
    firstName: "Robb",
    lastName: "Stark",
  },
  {
    firstName: "Sansa",
    lastName: "Stark",
  },
  {
    firstName: "Arya",
    lastName: "Stark",
  },
  {
    firstName: "Bran",
    lastName: "Stark",
  },
  {
    firstName: "Rickon",
    lastName: "Stark",
  },
];

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
  if (num % 10 == 0) {
    result.contacts = ({ first }) => {
      let ret: Contact[] = [];
      for (let i = 0; i < first; i++) {
        let idx = i % names.length;
        let name = names[idx]!;
        ret.push({
          firstName: name.firstName!,
          lastName: name.lastName!,
          emailAddress: `${name.firstName}@${name.lastName}.com`,
          phoneNumber: "415-222-3322",
          id: (i + 1000).toString(),
        });
      }
      return ret;
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

let contactType = new GraphQLObjectType({
  name: "ContactType",
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
    emailAddress: {
      type: GraphQLString,
    },
    phoneNumber: {
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
    contacts: {
      type: GraphQLList(contactType),
      args: {
        first: {
          type: GraphQLNonNull(GraphQLInt),
        },
      },
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

  test("with object passed", async () => {
    let cfg: queryRootConfig = {
      schema: schema,
      args: {
        id: "2",
      },
      root: "user",
    };

    await expectQueryFromRoot(cfg, [
      // TODO right now this is empty string, is there a better API for this?
      "",
      {
        id: "2",
        firstName: "Jon",
        lastName: "Snow",
        address: {
          id: "23",
          street: "1 main street",
          state: "CA",
          zipCode: "94102",
          apartment: null,
        },
      },
    ]);
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

test("query with nested args", async () => {
  let schema = new GraphQLSchema({
    query: rootQuery,
  });

  let cfg: queryRootConfig = {
    schema: schema,
    args: {
      id: "10",
    },
    root: "user",
  };

  await expectQueryFromRoot(
    cfg,
    ["id", "10"],
    ["firstName", "Jon"],
    ["lastName", "Snow"],
    ["contacts(first: 2)[0].firstName", "Robb"],
    ["contacts(first: 2)[0].lastName", "Stark"],
    ["contacts(first: 2)[0].emailAddress", "Robb@Stark.com"],
    ["contacts(first: 2)[1].firstName", "Sansa"],
    ["contacts(first: 2)[1].lastName", "Stark"],
    ["contacts(first: 2)[1].emailAddress", "Sansa@Stark.com"],
  );
});

test("query with object values", async () => {
  let schema = new GraphQLSchema({
    query: rootQuery,
  });

  let cfg: queryRootConfig = {
    schema: schema,
    args: {
      id: "10",
    },
    root: "user",
  };

  await expectQueryFromRoot(
    cfg,
    ["id", "10"],
    ["firstName", "Jon"],
    ["lastName", "Snow"],
    [
      // this is better because we don't have to write complex things many times
      "contacts(first: 2)",
      [
        {
          firstName: "Robb",
          lastName: "Stark",
          emailAddress: "Robb@Stark.com",
        },
        {
          firstName: "Sansa",
          lastName: "Stark",
          emailAddress: "Sansa@Stark.com",
        },
      ],
    ],
    [
      "address",
      {
        id: "23",
        street: "1 main street",
        state: "CA",
        zipCode: "94102",
        apartment: null,
      },
    ],
  );
});

test("nullQueryPaths with partial array", async () => {
  let rootQuery = new GraphQLObjectType({
    name: "RootQueryType",
    fields: {
      users: {
        args: {
          ids: {
            type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLID))),
          },
        },
        type: GraphQLNonNull(GraphQLList(userType)),
        resolve(_source, { ids }) {
          let ret: (User | null)[] = [];
          for (const id of ids) {
            let num = parseInt(id, 0) || 0;
            if (num % 2 == 0) {
              ret.push(null);
            } else {
              ret.push(getUser(id));
            }
          }
          return ret;
        },
      },
    },
  });
  let schema = new GraphQLSchema({
    query: rootQuery,
  });

  let cfg: queryRootConfig = {
    schema: schema,
    args: {
      ids: ["1", "2"],
    },
    root: "users",
    nullQueryPaths: ["[1]"],
  };

  await expectQueryFromRoot(
    cfg,
    ["[0].id", "1"],
    ["[0].firstName", "Jon"],
    ["[0].lastName", "Snow"],
    ["[1].id", null],
    ["[1].firstName", null],
    ["[1].lastName", null],
  );

  // non-nullQuery paths way of doing it
  cfg = {
    schema: schema,
    args: {
      ids: ["1", "2"],
    },
    root: "users",
  };

  await expectQueryFromRoot(cfg, [
    "",
    [
      {
        id: "1",
        firstName: "Jon",
        lastName: "Snow",
      },
      null,
    ],
  ]);
});
