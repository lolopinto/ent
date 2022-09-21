import { Viewer } from "../base";
import { FakeUser, UserToContactsQuery } from "../../testutils/fake_data/index";
import { commonTests } from "./shared_test";
import { assocTests } from "./shared_assoc_test";
import { MockLogs } from "../../testutils/mock_log";

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
  where: "id1 = $1 AND edge_type = $2",
  sortCol: "time",
  livePostgresDB: true,
});

assocTests(ml);

// TODO need to figure out a better way to test time. we had ms here
// for times but we needed Date object comparions
// tests work for both but production only works with Date comparisons
// flaw with nosql parse_sql implementation
