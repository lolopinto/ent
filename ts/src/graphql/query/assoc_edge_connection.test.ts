import { Pool } from "pg";
import { QueryRecorder } from "../../testutils/db_mock";
import { FakeUser, UserToContactsQuery } from "../../testutils/fake_data/index";
import { createEdges } from "../../testutils/fake_data/test_helpers";
import { commonTests } from "./shared_edge_connection";
import { sharedAssocTests } from "./shared_assoc_test";
jest.mock("pg");
QueryRecorder.mockPool(Pool);

beforeEach(async () => {
  QueryRecorder.clear();
  await createEdges();
  QueryRecorder.clearQueries();
});

commonTests({
  getQuery: (v, user: FakeUser) => new UserToContactsQuery(v, user),
  tableName: "user_to_contacts_table",
  sortCol: "time",
});

sharedAssocTests();
