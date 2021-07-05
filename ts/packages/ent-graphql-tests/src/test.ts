import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLID,
  GraphQLList,
  GraphQLBoolean,
  GraphQLInt,
} from "graphql";
import { GraphQLUpload, graphqlUploadExpress } from "graphql-upload";
import * as fs from "fs";

import {
  queryRootConfig,
  mutationRootConfig,
  expectQueryFromRoot,
  expectMutation,
} from "./index";

import { GraphQLNodeInterface } from "@snowtop/ent/graphql";

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

interface Node {
  id: string;
}

class Address implements Node {
  id: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  apartment?: string | null;
}

class User implements Node {
  id: string;
  firstName: string;
  lastName: string;
  address?: Address | null;
  contacts?({ first: number }): Contact[];
  nicknames?: string[] | null;
}

class Contact implements Node {
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

const NickNames = ["Lord Snow", "The Prince That was Promised"];
function getUser(id: string): User {
  let result = new User();
  result.id = id;
  result.firstName = "Jon";
  result.lastName = "Snow";

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

  if (num === 1001) {
    result.nicknames = NickNames;
  }
  return result;
}

function editUser(id: string, user: Partial<User>): User {
  let result = getUser(id);
  for (const k in user) {
    result[k] = user[k];
  }
  return result;
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
  interfaces: [GraphQLNodeInterface],
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
  interfaces: [GraphQLNodeInterface],
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
    nicknames: {
      type: GraphQLList(GraphQLNonNull(GraphQLString)),
    },
  },
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj, context) {
    const isUser = obj instanceof User;
    return context.async ? Promise.resolve(isUser) : isUser;
  },
});

let viewerType = new GraphQLObjectType({
  name: "Viewer",
  fields: {
    user: {
      type: GraphQLNonNull(userType),
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

let viewerRootQuery = new GraphQLObjectType({
  name: "RootQueryType",
  fields: {
    viewer: {
      type: viewerType,
      resolve() {
        return {
          user: getUser("20"),
        };
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
          setTimeout(() => resolve(null), 10);
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
      "contacts(first: 5)",
      [
        {
          firstName: "Robb",
          lastName: "Stark",
          emailAddress: "Robb@Stark.com",
          phoneNumber: "415-222-3322",
        },
        {
          firstName: "Sansa",
          lastName: "Stark",
          emailAddress: "Sansa@Stark.com",
          phoneNumber: "415-222-3322",
        },
        {
          firstName: "Arya",
          lastName: "Stark",
          emailAddress: "Arya@Stark.com",
          phoneNumber: "415-222-3322",
        },
        {
          firstName: "Bran",
          lastName: "Stark",
          emailAddress: "Bran@Stark.com",
          phoneNumber: "415-222-3322",
        },
        {
          firstName: "Rickon",
          lastName: "Stark",
          emailAddress: "Rickon@Stark.com",
          phoneNumber: "415-222-3322",
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
    ["nicknames", null],
  );
});

test("query scalar list", async () => {
  let schema = new GraphQLSchema({
    query: rootQuery,
  });

  let cfg: queryRootConfig = {
    schema: schema,
    args: {
      id: "1001",
    },
    root: "user",
  };

  await expectQueryFromRoot(
    cfg,
    ["id", "1001"],
    ["firstName", "Jon"],
    ["lastName", "Snow"],
    ["nicknames", NickNames],
  );
});

test("nested query with object values", async () => {
  let schema = new GraphQLSchema({
    query: viewerRootQuery,
  });

  let cfg: queryRootConfig = {
    schema: schema,
    args: {},
    root: "viewer",
  };

  await expectQueryFromRoot(
    cfg,
    ["user.id", "20"],
    ["user.firstName", "Jon"],
    ["user.lastName", "Snow"],
    // TODO would be nice for this to be a partial query but not there yet
    // [
    //   "user",
    //   {
    //     id: "20",
    //     firstName: "Jon",
    //     lastName: "Snow",
    //   },
    // ],
    [
      "user.contacts(first: 5)",
      [
        {
          firstName: "Robb",
          lastName: "Stark",
          emailAddress: "Robb@Stark.com",
          phoneNumber: "415-222-3322",
        },
        {
          firstName: "Sansa",
          lastName: "Stark",
          emailAddress: "Sansa@Stark.com",
          phoneNumber: "415-222-3322",
        },
        {
          firstName: "Arya",
          lastName: "Stark",
          emailAddress: "Arya@Stark.com",
          phoneNumber: "415-222-3322",
        },
        {
          firstName: "Bran",
          lastName: "Stark",
          emailAddress: "Bran@Stark.com",
          phoneNumber: "415-222-3322",
        },
        {
          firstName: "Rickon",
          lastName: "Stark",
          emailAddress: "Rickon@Stark.com",
          phoneNumber: "415-222-3322",
        },
      ],
    ],
  );
});

test("nullQueryPaths with nullable list contents", async () => {
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

test("nullQueryPaths with nullable list", async () => {
  let schema = new GraphQLSchema({
    query: rootQuery,
  });

  let cfg: queryRootConfig = {
    schema: schema,
    args: {
      id: "1",
    },
    root: "user",
    nullQueryPaths: ["contacts"],
  };

  await expectQueryFromRoot(
    cfg,
    ["id", "1"],
    ["firstName", "Jon"],
    ["lastName", "Snow"],
    ["contacts(first: 2)[0].firstName", null],
    ["contacts(first: 2)[0].lastName", null],
    ["contacts(first: 2)[0].emailAddress", null],
  );
});

test("undefinedQueryPaths", async () => {
  let schema = new GraphQLSchema({
    query: rootQuery,
  });

  let cfg: queryRootConfig = {
    schema: schema,
    args: {
      id: "10",
    },
    root: "user",
    undefinedQueryPaths: ["contacts"],
  };

  await expectQueryFromRoot(
    cfg,
    ["id", "10"],
    ["firstName", "Jon"],
    ["lastName", "Snow"],
    ["contacts(first: 0)[0].firstName", undefined],
  );
});

describe("inline fragments", () => {
  let rootQuery = new GraphQLObjectType({
    name: "RootQueryType",
    fields: {
      node: {
        args: {
          id: {
            type: GraphQLNonNull(GraphQLID),
          },
        },
        type: GraphQLNodeInterface,
        resolve(_source, { id }) {
          return getUser(id);
        },
      },
    },
  });

  let schema = new GraphQLSchema({
    query: rootQuery,
    types: [userType, contactType, addressType],
  });

  let cfg: queryRootConfig = {
    schema: schema,
    args: {
      id: "10",
    },
    root: "node",
  };

  test("basic", async () => {
    await expectQueryFromRoot(cfg, [
      "...on User",
      {
        id: "10",
        firstName: "Jon",
        lastName: "Snow",
      },
    ]);
  });

  test("list", async () => {
    let cfg2 = {
      ...cfg,
      args: {
        id: "1001",
      },
    };
    await expectQueryFromRoot(cfg2, [
      "...on User",
      {
        id: "1001",
        firstName: "Jon",
        lastName: "Snow",
        nicknames: NickNames,
      },
    ]);
  });

  test("inline fragment root", async () => {
    let cfg: queryRootConfig = {
      schema: schema,
      args: {
        id: "10",
      },
      root: "node",
      inlineFragmentRoot: "User",
    };

    await expectQueryFromRoot(
      cfg,
      ["id", "10"],
      ["firstName", "Jon"],
      ["lastName", "Snow"],
    );
  });

  test("inline fragment root with list", async () => {
    let cfg: queryRootConfig = {
      schema: schema,
      args: {
        id: "1001",
      },
      root: "node",
      inlineFragmentRoot: "User",
    };

    await expectQueryFromRoot(
      cfg,
      ["id", "1001"],
      ["firstName", "Jon"],
      ["lastName", "Snow"],
      ["nicknames", NickNames],
    );
  });
});

describe("file upload", () => {
  async function readStream(file): Promise<string> {
    return await new Promise((resolve) => {
      const stream = file.createReadStream();
      let data: string[] = [];
      stream.on("data", function (chunk) {
        data.push(chunk.toString());
      });

      stream.on("close", function () {
        return resolve(data.join(""));
      });
    });
  }

  const fileContents = ["col1,col2", "data1,data2"].join("\n");
  const paths = ["foo.csv", "foo2.csv"];

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
      },
    }),
    mutation: new GraphQLObjectType({
      name: "RootMutationType",
      fields: {
        fileUpload: {
          type: GraphQLNonNull(GraphQLBoolean),
          args: {
            file: {
              type: GraphQLNonNull(GraphQLUpload),
            },
          },
          async resolve(src, args) {
            const file = await args.file;

            const data = await readStream(file);
            if (data !== fileContents) {
              throw new Error(`invalid file sent`);
            }

            return true;
          },
        },
        fileUploadMultiple: {
          type: GraphQLNonNull(GraphQLBoolean),
          args: {
            files: {
              type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLUpload))),
            },
          },
          async resolve(src, args) {
            await Promise.all(
              args.files.map(async (f) => {
                const file = await f;
                const data = await readStream(file);
                if (data !== fileContents) {
                  throw new Error(`invalid file sent`);
                }
                return data;
              }),
            );

            return true;
          },
        },
      },
    }),
  });

  beforeAll(() => {
    paths.forEach((path) =>
      fs.writeFileSync(path, fileContents, {
        encoding: "utf-8",
      }),
    );
  });

  afterAll(() => {
    paths.forEach((path) => fs.unlinkSync(path));
  });

  test("file path", async () => {
    await expectMutation(
      {
        schema: schema,
        mutation: "fileUpload",
        args: {
          file: "foo.csv",
        },
        disableInputWrapping: true,
        customHandlers: [
          graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
        ],
      },
      [".", true],
    );
  });

  test("with stream", async () => {
    await expectMutation(
      {
        schema: schema,
        mutation: "fileUpload",
        args: {
          file: fs.createReadStream("foo.csv"),
        },
        disableInputWrapping: true,
        customHandlers: [
          graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
        ],
      },
      [".", true],
    );
  });

  test("with buffer", async () => {
    await expectMutation(
      {
        schema: schema,
        mutation: "fileUpload",
        args: {
          file: fs.readFileSync("foo.csv"),
        },
        disableInputWrapping: true,
        customHandlers: [
          graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
        ],
      },
      [".", true],
    );
  });

  test("no graphqlUploadExpress", async () => {
    await expectMutation(
      {
        schema: schema,
        mutation: "fileUpload",
        args: {
          file: "foo.csv",
        },
        disableInputWrapping: true,
        expectedStatus: 400,
        // TODO not sure where this error from is but it's failing as expected which is fine
        expectedError: /Must provide query string/,
      },
      [".", true],
    );
  });

  test("multiple files", async () => {
    await expectMutation(
      {
        schema: schema,
        mutation: "fileUploadMultiple",
        args: {
          files: paths,
        },
        disableInputWrapping: true,
        customHandlers: [
          graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
        ],
      },
      [".", true],
    );
  });
});

test("false boolean", async () => {
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
            log: {
              type: GraphQLBoolean,
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
      log: false,
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
