import {
  EdgeType,
  FakeUser,
  UserToContactsQuery,
} from "../../testutils/fake_data/index.js";
import { inputs } from "../../testutils/fake_data/test_helpers.js";
import { MockLogs } from "../../testutils/mock_log.js";
import { EdgeWithDeletedAt } from "../../testutils/test_edge_global_schema.js";
import { Viewer } from "../base.js";
import { And, Eq } from "../clause.js";
import { convertDate } from "../convert.js";
import { loadCustomEdges } from "../ent.js";
import { assocTests } from "./shared_assoc_test.js";
import { commonTests } from "./shared_test.js";

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
  clause: And(Eq("id1", ""), Eq("edge_type", ""), Eq("deleted_at", null)),
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

assocTests(ml, true);

// TODO need to figure out a better way to test time. we had ms here
// for times but we needed Date object comparions
// tests work for both but production only works with Date comparisons
// flaw with nosql parse_sql implementation
