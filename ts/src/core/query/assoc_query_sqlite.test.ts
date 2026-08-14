import { setupSqlite } from "../../testutils/db/temp_db.js";
import {
  EdgeType,
  FakeUser,
  UserToContactsQuery,
} from "../../testutils/fake_data/index.js";
import { tempDBTables } from "../../testutils/fake_data/test_helpers.js";
import { MockLogs } from "../../testutils/mock_log.js";
import { EdgeWithDeletedAt } from "../../testutils/test_edge_global_schema.js";
import { Viewer } from "../base.js";
import { And, Eq } from "../clause.js";
import { loadCustomEdges } from "../ent.js";
import { assocTests } from "./shared_assoc_test.js";
import { commonTests } from "./shared_test.js";

const ml = new MockLogs();
ml.mock();

describe("assoc query desc", () => {
  commonTests({
    newQuery(viewer: Viewer, user: FakeUser) {
      return UserToContactsQuery.query(viewer, user);
    },
    ml,
    tableName: "user_to_contacts_table",
    uniqKey: "user_to_contacts_table_sqlite",
    entsLength: 2,
    clause: And(Eq("id1", ""), Eq("edge_type", "")),
    sqlite: true,
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
      expect(withDeleted.length).toBe(0);
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
});

describe("custom assoc", () => {
  setupSqlite(`sqlite:///assoc_query_sqlite.db`, tempDBTables);

  assocTests(ml);
});
