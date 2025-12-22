import { convertDate } from "../../core/convert.js";
import { setupSqlite } from "../../testutils/db/temp_db.js";
import {
  EdgeType,
  FakeUser,
  UserToContactsQuery,
} from "../../testutils/fake_data/index.js";
import { inputs, tempDBTables } from "../../testutils/fake_data/test_helpers.js";
import { MockLogs } from "../../testutils/mock_log.js";
import { EdgeWithDeletedAt } from "../../testutils/test_edge_global_schema.js";
import { Viewer } from "../base.js";
import { And, Eq } from "../clause.js";
import { loadCustomEdges } from "../ent.js";
import { assocTests } from "./shared_assoc_test.js";
import { commonTests } from "./shared_test.js";

const ml = new MockLogs();
ml.mock();

// deleted_at column added for this case and assoc tests should work
commonTests({
  newQuery(viewer: Viewer, user: FakeUser) {
    return UserToContactsQuery.query(viewer, user);
  },
  ml,
  tableName: "user_to_contacts_table",
  uniqKey: "user_to_contacts_table_global",
  entsLength: 2,
  clause: And(Eq("id1", ""), Eq("edge_type", ""), Eq("deleted_at", null)),
  sqlite: true,
  globalSchema: true,
  rawDataVerify: async (user: FakeUser) => {
    const [raw, withDeleted] = await Promise.all([
      loadCustomEdges({
        id1: user.id,
        edgeType: EdgeType.UserToContacts,
        ctr: EdgeWithDeletedAt,
      }),
      loadCustomEdges({
        id1: user.id,
        edgeType: EdgeType.UserToContacts,
        ctr: EdgeWithDeletedAt,
        queryOptions: {
          disableTransformations: true,
        },
      }),
    ]);
    expect(raw.length).toBe(0);
    expect(withDeleted.length).toBe(inputs.length);
    withDeleted.map((edge) => {
      expect(edge.deletedAt).not.toBe(null);
      expect(convertDate(edge.deletedAt!)).toBeInstanceOf(Date);
    });
  },
  orderby: [
    {
      column: "time",
      direction: "DESC",
    },
    {
      column: "id2",
      direction: "DESC",
    },
  ],
});

describe("custom assoc", () => {
  setupSqlite(`sqlite:///assoc_query_sqlite_global.db`, () =>
    tempDBTables(true),
  );

  // TODO there's a weird dependency with commonTest above where commenting that out breaks this...
  assocTests(ml, true);
});
