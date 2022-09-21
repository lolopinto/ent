import { Pool } from "pg";
import { QueryRecorder } from "../../testutils/db_mock";
import { Viewer } from "../base";
import {
  EdgeType,
  FakeUser,
  UserToContactsQuery,
} from "../../testutils/fake_data/index";
import { createEdges, inputs } from "../../testutils/fake_data/test_helpers";
import { commonTests } from "./shared_test";
import { assocTests } from "./shared_assoc_test";
import { loadCustomEdges } from "../ent";
import { EdgeWithDeletedAt } from "../../testutils/test_edge_global_schema";
import { convertDate } from "../convert";
import { MockLogs } from "../../testutils/mock_log";

const ml = new MockLogs();
ml.mock();

commonTests({
  newQuery(viewer: Viewer, user: FakeUser) {
    return UserToContactsQuery.query(viewer, user);
  },
  ml,
  uniqKey: "user_to_contacts_table",
  tableName: "user_to_contacts_table",
  entsLength: 2,
  where: "id1 = $1 AND edge_type = $2 AND deleted_at IS NULL",
  sortCol: "time",
  globalSchema: true,
  livePostgresDB: true,
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

assocTests(ml, true);

// TODO need to figure out a better way to test time. we had ms here
// for times but we needed Date object comparions
// tests work for both but production only works with Date comparisons
// flaw with nosql parse_sql implementation
