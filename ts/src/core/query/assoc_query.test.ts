import { FakeUser, UserToContactsQuery } from "../../testutils/fake_data/index.js";
import { MockLogs } from "../../testutils/mock_log.js";
import { Viewer } from "../base.js";
import { And, Eq } from "../clause.js";
import { assocTests } from "./shared_assoc_test.js";
import { commonTests } from "./shared_test.js";

// shared mock across tests
// should this be global?
const ml = new MockLogs();
ml.mock();

commonTests({
  newQuery(viewer: Viewer, user: FakeUser) {
    return UserToContactsQuery.query(viewer, user);
  },
  ml,
  tableName: "user_to_contacts_table",
  uniqKey: "user_to_contacts_table",
  entsLength: 2,
  clause: And(Eq("id1", ""), Eq("edge_type", "")),
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
  livePostgresDB: true,
});

assocTests(ml);

// TODO need to figure out a better way to test time. we had ms here
// for times but we needed Date object comparions
// tests work for both but production only works with Date comparisons
// flaw with nosql parse_sql implementation
