// TODO time to test query

//but fake_data is in tests so maybe we don't want this here

import { Pool } from "pg";
import { QueryRecorder } from "../src/testutils/db_mock";
import { EdgeType } from "./fake_data/const";
import { snakeCase } from "snake-case";
import { createRowForTest } from "../src/testutils/write";
import { AssocEdge, Data, ID, loadEdgeData, Viewer } from "../src/core/ent";
import {
  createUser,
  FakeUser,
  UserCreateInput,
  UserToContactsQuery,
} from "./fake_data/fake_user";
import { IDViewer, LoggedOutViewer } from "../src/core/viewer";
import { fail } from "assert";
import {
  ContactCreateInput,
  FakeContact,
  getContactBuilder,
} from "./fake_data/fake_contact";
import { advanceBy } from "jest-date-mock";
import * as clause from "../src/core/clause";
import { User } from "../src/testutils/builder";
import { isExportDeclaration } from "typescript";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

beforeEach(async () => {
  QueryRecorder.clear();
  // create all edges// for now all one-way
  // TODO figure out symmetric and inverse later
  // maybe move this to testutils as a helper
  const edgeNames = Object.keys(EdgeType);
  const edges = Object.values(EdgeType);

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    await createRowForTest({
      tableName: "assoc_edge_config",
      fields: {
        edge_table: snakeCase(`${edge}_table`),
        symmetric_edge: false,
        inverse_edge_type: null,
        edge_type: edge,
        edge_name: edgeNames[i],
      },
    });
    const edgeData = await loadEdgeData(edge);
    //    console.log(edgeData);
  }
  QueryRecorder.clearQueries();
});

function getContactInput(
  user: FakeUser,
  input?: Partial<ContactCreateInput>,
): ContactCreateInput {
  return {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: "foo@bar.com",
    userID: user.id,
    ...input,
  };
}

async function createTestUser(
  input?: Partial<UserCreateInput>,
): Promise<FakeUser> {
  const user = await createUser(new LoggedOutViewer(), {
    firstName: "Jon",
    lastName: "Snow",
    password: "12345678",
    phoneNumber: "4152221231",
    emailAddress: "foo@bar.com",
    ...input,
  });
  if (!user) {
    fail("error creating user");
  }
  return user;
}

const inputs: Partial<ContactCreateInput>[] = [
  {
    firstName: "Arya",
    lastName: "Stark",
  },
  {
    firstName: "Robb",
    lastName: "Stark",
  },
  {
    firstName: "Sansa",
    lastName: "Stark",
  },
  {
    firstName: "Rickon",
    lastName: "Stark",
  },
  {
    firstName: "Bran",
    lastName: "Stark",
  },
];

async function createAllContacts(): Promise<[FakeUser, FakeContact[]]> {
  const user = await createTestUser();

  const contacts = await Promise.all(
    inputs.map(async (input) => {
      // just to make times deterministic so that tests can consistently work
      advanceBy(100);
      const builder = getContactBuilder(
        user.viewer,
        getContactInput(user, input),
      );
      // add edge from user to contact
      builder.orchestrator.addInboundEdge(
        user.id,
        EdgeType.UserToContacts,
        "User",
        {
          time: new Date(), // set time to advanceBy time
        },
      );
      return await builder.saveX();
    }),
  );
  expect(contacts.length).toBe(inputs.length);
  return [user, contacts];
}

function verifyUserToContactEdges(
  user: FakeUser,
  edgesMap: Map<ID, AssocEdge[]>,
  contacts: FakeContact[],
) {
  const edges = edgesMap.get(user.id) || [];
  expect(edges.length).toBe(contacts.length);

  for (let i = 0; i < contacts.length; i++) {
    const edge = edges[i];
    const expectedEdge = {
      id1: user.id,
      id1Type: "User",
      id2: contacts[i].id,
      id2Type: "Contact",
      data: null,
      edgeType: EdgeType.UserToContacts,
    };
    expect(edge, `${i}th index`).toMatchObject(expectedEdge);
    expect(edge.getCursor()).not.toBe("");
  }
}

function verifyUserToContacts(
  user: FakeUser,
  entsMap: Map<ID, FakeContact[]>,
  contacts: FakeContact[],
) {
  const ents = entsMap.get(user.id) || [];
  expect(ents.length).toBe(contacts.length);
  const expectedContacts = contacts.map((contact) => contact.id);

  expect(ents.map((contact) => contact.id)).toStrictEqual(expectedContacts);
}

class TestQueryFilter {
  private contacts: FakeContact[] = [];
  private user: FakeUser;
  constructor(
    private filter: (
      q: UserToContactsQuery,
      user: FakeUser,
    ) => UserToContactsQuery,
    private ents: (contacts: FakeContact[]) => FakeContact[],
  ) {}

  async beforeEach() {
    [this.user, this.contacts] = await createAllContacts();
    this.contacts = this.ents(this.contacts);
    QueryRecorder.clearQueries();
  }

  getQuery(viewer?: Viewer) {
    return this.filter(
      UserToContactsQuery.query(viewer || new LoggedOutViewer(), this.user),
      this.user,
    );
  }

  async testIDs() {
    const idsMap = await this.getQuery().queryIDs();
    expect(idsMap.size).toBe(1);

    expect(idsMap.get(this.user.id)).toStrictEqual(
      this.contacts.map((contact) => contact.id),
    );
  }

  // rawCount isn't affected by filters...
  async testRawCount() {
    const countMap = await this.getQuery().queryRawCount();
    expect(countMap.size).toBe(1);

    expect(countMap.get(this.user.id)).toBe(inputs.length);
  }

  async testCount() {
    const countMap = await this.getQuery().queryCount();
    expect(countMap.size).toBe(1);

    expect(countMap.get(this.user.id)).toBe(this.contacts.length);
  }

  async testEdges() {
    const edgesMap = await this.getQuery().queryEdges();
    expect(edgesMap.size).toBe(1);

    verifyUserToContactEdges(this.user, edgesMap, this.contacts);
  }

  async testEnts() {
    const entsMap = await this.getQuery(new IDViewer(this.user.id)).queryEnts();
    expect(entsMap.size).toBe(1);
    verifyUserToContacts(this.user, entsMap, this.contacts);
  }
}

describe("simple queries", () => {
  const filter = new TestQueryFilter(
    (q: UserToContactsQuery) => {
      // no filters
      return q;
    },
    (contacts: FakeContact[]) => {
      // nothing to do here
      // reverse because edges are most recent first
      return contacts.reverse();
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
  });

  test("rawCount", async () => {
    await filter.testRawCount();
  });

  test("count", async () => {
    await filter.testCount();
  });

  test("edges", async () => {
    await filter.testEdges();
  });

  test("ents", async () => {
    await filter.testEnts();
  });
});

describe("firstN", () => {
  const N = 2;
  const filter = new TestQueryFilter(
    (q: UserToContactsQuery) => {
      return q.firstN(N);
    },
    (contacts: FakeContact[]) => {
      return contacts.reverse().slice(0, N);
    },
  );

  function verifyQuery(length: number = 1) {
    const queries = QueryRecorder.getCurrentQueries();
    expect(queries.length).toBe(length);
    const query = queries[0];
    expect(query.qs?.whereClause).toBe(
      // default limit
      "id1 = $1 AND edge_type = $2 ORDER BY time DESC LIMIT 1000",
    );
  }

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
    verifyQuery();
  });

  test("rawCount", async () => {
    await filter.testRawCount();
  });

  test("count", async () => {
    await filter.testCount();
    verifyQuery();
  });

  test("edges", async () => {
    await filter.testEdges();
    verifyQuery();
  });

  test("ents", async () => {
    await filter.testEnts();
    // 2nd query to load the ents
    verifyQuery(2);
  });
});

describe("firstN sql mode", () => {
  const N = 2;
  const filter = new TestQueryFilter(
    (q: UserToContactsQuery) => {
      return q.sql().firstN(N);
    },
    (contacts: FakeContact[]) => {
      return contacts.reverse().slice(0, N);
    },
  );

  function verifyLimitInQuery(length: number = 1) {
    const queries = QueryRecorder.getCurrentQueries();
    expect(queries.length).toBe(length);
    const query = queries[0];
    expect(query.qs?.whereClause).toBe(
      "id1 = $1 AND edge_type = $2 ORDER BY time DESC LIMIT 2",
    );
  }

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
    verifyLimitInQuery();
  });

  test("rawCount", async () => {
    await filter.testRawCount();
  });

  test("count", async () => {
    await filter.testCount();
    verifyLimitInQuery();
  });

  test("edges", async () => {
    await filter.testEdges();
    verifyLimitInQuery();
  });

  test("ents", async () => {
    await filter.testEnts();
    // 2nd query to load the ents
    verifyLimitInQuery(2);
  });
});

describe("lastN", () => {
  const N = 2;
  const filter = new TestQueryFilter(
    (q: UserToContactsQuery) => {
      return q.lastN(N);
    },
    (contacts: FakeContact[]) => {
      // take the first N and then reverse it to get the last N in the right order
      return contacts.slice(0, N).reverse();
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
  });

  test("rawCount", async () => {
    await filter.testRawCount();
  });

  test("count", async () => {
    await filter.testCount();
  });

  test("edges", async () => {
    await filter.testEdges();
  });

  test("ents", async () => {
    await filter.testEnts();
  });
});

describe("beforeCursor", () => {
  const idx = 2;
  const N = 3;
  let rows: Data[] = [];
  const filter = new TestQueryFilter(
    (q: UserToContactsQuery, user: FakeUser) => {
      rows = QueryRecorder.filterData("user_to_contacts_table", (row) => {
        return row.id1 === user.id;
      }).reverse(); // need to reverse
      const cursor = new AssocEdge(rows[idx]).getCursor();

      // TODO things like this which are always sql don't need this
      //
      return q.sql().beforeCursor(cursor, N);
    },
    (contacts: FakeContact[]) => {
      // < check so we shouldn't get that index
      return contacts.reverse().slice(idx + 1, idx + N);
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
  });

  test("rawCount", async () => {
    await filter.testRawCount();
  });

  test("count", async () => {
    await filter.testCount();
  });

  test("edges", async () => {
    await filter.testEdges();
  });

  test("ents", async () => {
    await filter.testEnts();
  });
});

test("beforeCursor each cursor", async () => {
  let [user, contacts] = await createAllContacts();
  contacts = contacts.reverse();
  const edgesMap = await UserToContactsQuery.query(
    new LoggedOutViewer(),
    user.id,
  ).queryEdges();

  const edges = edgesMap.get(user.id) || [];
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const hasEdge = i !== edges.length - 1;

    const newEdgeMap = await UserToContactsQuery.query(
      new LoggedOutViewer(),
      user.id,
    )
      .sql()
      .beforeCursor(edge.getCursor(), 1)
      .queryEdges();

    const newEdges = newEdgeMap.get(user.id) || [];
    if (hasEdge) {
      expect(newEdges.length, `${i}`).toBe(1);
      expect(newEdges[0], `${i}`).toStrictEqual(edges[i + 1]);
    } else {
      expect(newEdges.length, `${i}`).toBe(0);
    }
    // TODO we have no current way to know if there's more results so we need to fetch an extra one here and then discard it
  }
});
