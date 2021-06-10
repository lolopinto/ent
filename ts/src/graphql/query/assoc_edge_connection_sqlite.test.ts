import { FakeUser, UserToContactsQuery } from "../../testutils/fake_data/index";
import {
  createEdges,
  tempDBTables,
} from "../../testutils/fake_data/test_helpers";
import { commonTests } from "./shared_edge_connection";
import { sharedAssocTests } from "./shared_assoc_test";
import { setupSqlite } from "../../testutils/db/test_db";

beforeEach(async () => {
  await createEdges();
});

setupSqlite(`sqlite:///assoc_edge_connection.db`, tempDBTables);

commonTests({
  getQuery: (v, user: FakeUser) => new UserToContactsQuery(v, user),
  tableName: "user_to_contacts_table",
  sortCol: "time",
});

sharedAssocTests();
