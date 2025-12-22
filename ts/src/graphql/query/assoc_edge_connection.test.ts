import { FakeUser, UserToContactsQuery } from "../../testutils/fake_data/index.js";
import { commonTests } from "./shared_edge_connection.js";
import { sharedAssocTests } from "./shared_assoc_test.js";
import { TempDB } from "../../testutils/db/temp_db.js";
import { setupTempDB } from "../../testutils/fake_data/test_helpers.js";

let tdb: TempDB;

beforeAll(async () => {
  tdb = await setupTempDB();
});

afterAll(async () => {
  await tdb.afterAll();
});

commonTests({
  getQuery: (v, user: FakeUser) => new UserToContactsQuery(v, user),
  tableName: "user_to_contacts_table",
  sortCol: "time",
});

sharedAssocTests();
