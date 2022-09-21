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
import { inputs } from "../../testutils/fake_data/test_helpers";
import { convertDate } from "../../core/convert";
import { MockLogs } from "../../testutils/mock_log";

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
  where: "id1 = ? AND edge_type = ? AND deleted_at IS NULL",
  sortCol: "time",
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
        disableTransformations: true,
      }),
    ]);
    expect(raw.length).toBe(0);
    expect(withDeleted.length).toBe(inputs.length);
    withDeleted.map((edge) => {
      expect(edge.deletedAt).not.toBe(null);
      expect(convertDate(edge.deletedAt!)).toBeInstanceOf(Date);
    });
  },
});

describe("custom assoc", () => {
  // DB.getInstance is broken. so we need the same assoc instance to be used
  //  setupSqlite(`sqlite:///assoc_query_sqlite.db`, tempDBTables);

  // TODO there's a weird dependency with commonTest above where commenting that out breaks this...
  assocTests(ml, true);
});
