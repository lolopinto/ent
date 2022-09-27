import { Viewer } from "../base";
import {
  EdgeType,
  FakeUser,
  UserToContactsQuery,
} from "../../testutils/fake_data/index";
import { commonTests } from "./shared_test";
import { assocTests } from "./shared_assoc_test";
import { loadCustomEdges } from "../ent";
import { EdgeWithDeletedAt } from "../../testutils/test_edge_global_schema";
import { MockLogs } from "../../testutils/mock_log";
import { And, Eq } from "../clause";
import { setupSqlite } from "../../testutils/db/temp_db";
import { tempDBTables } from "../../testutils/fake_data/test_helpers";

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
    sortCol: "time",
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
          disableTransformations: true,
        }),
      ]);
      expect(raw.length).toBe(0);
      expect(withDeleted.length).toBe(0);
    },
    orderby: "DESC",
  });
});

describe("custom assoc", () => {
  setupSqlite(`sqlite:///assoc_query_sqlite.db`, tempDBTables);

  assocTests(ml);
});
