import { Pool } from "pg";
import { QueryRecorder } from "../../testutils/db_mock";
import { Viewer } from "../base";
import { FakeUser, UserToContactsQuery } from "../../testutils/fake_data/index";
import { createEdges } from "../../testutils/fake_data/test_helpers";
import { commonTests } from "./shared_test";
import { assocTests } from "./shared_assoc_test";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

beforeEach(async () => {
  QueryRecorder.clear();
  await createEdges();
  QueryRecorder.clearQueries();
});

commonTests({
  newQuery(viewer: Viewer, user: FakeUser) {
    return UserToContactsQuery.query(viewer, user);
  },
  tableName: "user_to_contacts_table",
  entsLength: 2,
  where: "id1 = $1 AND edge_type = $2",
  sortCol: "time",
});

assocTests();

// TODO need to figure out a better way to test time. we had ms here
// for times but we needed Date object comparions
// tests work for both but production only works with Date comparisons
// flaw with nosql parse_sql implementation
