import { Data, Ent } from "../../core/base";
import { EdgeQuery } from "../../core/query/query";
import { GraphQLEdgeConnection } from "./edge_connection";
import { createAllContacts } from "../../testutils/fake_data/test_helpers";
import { TempDB } from "../../testutils/db/temp_db";

import { FakeUser, FakeContact } from "../../testutils/fake_data/index";
import { setupTempDB } from "../../testutils/fake_data/test_helpers";
import { commonTests } from "./shared_edge_connection";
import { CustomClauseQuery } from "../../core/query/custom_clause_query";
import * as clause from "../../core/clause";

let tdb: TempDB;

beforeAll(async () => {
  tdb = await setupTempDB();
});

afterAll(async () => {
  await tdb.afterAll();
});

commonTests({
  getQuery: (v, user: FakeUser) =>
    new CustomClauseQuery(v, {
      loadEntOptions: FakeContact.loaderOptions(),
      clause: clause.Eq("user_id", user.id),
      name: "userToContacts",
      orderby: [
        {
          column: "created_at",
          direction: "DESC",
        },
      ],
    }),
  tableName: "fake_contacts",
  sortCol: "created_at",
});

test.each([
  "count",
  "rows",
])("in-flight %s keeps parent connection pagination", async (read) => {
  const [user, contacts] = await createAllContacts();
  const q = contactQuery(user).first(2);
  const started = read === "count" ? q.queryRawCount() : q.queryEdges();
  const conn = new GraphQLEdgeConnection(user.viewer, user, async () => q);
  const [page, edges, count] = await Promise.all([
    conn.queryPageInfo(),
    conn.queryEdges(),
    conn.queryTotalCount(),
    started,
  ]);
  expect(count).toBe(contacts.length);
  expect(page).toMatchObject({ hasNextPage: true, hasPreviousPage: false });
  expect(page.startCursor).toBe(edges[0].cursor);
  expect(page.endCursor).toBe(edges[1].cursor);
});

test("root last/before pagination shares its result with concurrent counts", async () => {
  const [user, contacts] = await createAllContacts();
  contacts.reverse();
  const q = contactQuery(user);
  const cursor = q.getCursor(contacts[4].data);
  const conn = new GraphQLEdgeConnection(user.viewer, async () => q, {
    last: 2,
    before: cursor,
  });
  const [edges, page, count] = await Promise.all([
    conn.queryEdges(),
    conn.queryPageInfo(),
    conn.queryTotalCount(),
  ]);
  expect(count).toBe(contacts.length);
  expect(edges.map((edge) => edge.node.id)).toEqual(
    contacts
      .slice(2, 4)
      .reverse()
      .map((c) => c.id),
  );
  expect(page).toMatchObject({ hasPreviousPage: true, hasNextPage: false });
  expect(page.startCursor).toBe(edges[0].cursor);
  expect(page.endCursor).toBe(edges[1].cursor);
});

test("legacy EdgeQuery factories and full modifyQuery callbacks remain supported", async () => {
  const [user] = await createAllContacts();
  const q = contactQuery(user).first(2);
  // This is a third-party implementation of the pre-existing EdgeQuery shape:
  // grouped pagination only, with no singular queryPageInfo method.
  const legacy: EdgeQuery<Ent, FakeContact, Data> = {
    queryEdges: q.queryEdges,
    queryEnts: q.queryEnts,
    queryIDs: q.queryIDs,
    queryCount: q.queryCount,
    queryRawCount: () => q.queryRawCount(),
    queryAllEdges: q.queryAllEdges,
    queryAllEnts: q.queryAllEnts,
    queryAllIDs: q.queryAllIDs,
    queryAllCount: q.queryAllCount,
    queryAllRawCount: () => q.queryAllRawCount(),
    getCursor: (row) => q.getCursor(row),
    dataToID: (row) => q.dataToID(row),
    getPrivacyPolicy: () => q.getPrivacyPolicy(),
    sourceEnt: (id) => q.sourceEnt(id),
    first: (n, cursor) => {
      q.first(n, cursor);
      return legacy;
    },
    last: (n, cursor) => {
      q.last(n, cursor);
      return legacy;
    },
    paginationInfo: () => new Map([[user.id, q.paginationInfo().get(1)!]]),
  };
  const conn = new GraphQLEdgeConnection(user.viewer, user, async () => legacy);
  conn.modifyQuery((query: EdgeQuery<Ent, Ent, Data>) => {
    expect(typeof query.queryAllIDs).toBe("function");
    return query;
  });
  expect((await conn.queryPageInfo()).hasNextPage).toBe(true);
  expect((await conn.query).paginationInfo().has(user.id)).toBe(true);
});

function contactQuery(user: FakeUser) {
  return new CustomClauseQuery(user.viewer, {
    loadEntOptions: FakeContact.loaderOptions(),
    clause: clause.Eq("user_id", user.id),
    name: "contact-pagination-regression",
    orderby: [{ column: "created_at", direction: "DESC" }],
  });
}
