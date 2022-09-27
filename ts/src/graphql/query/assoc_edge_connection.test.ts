import { FakeUser, UserToContactsQuery } from "../../testutils/fake_data/index";
import { commonTests } from "./shared_edge_connection";
import { sharedAssocTests } from "./shared_assoc_test";
import { TempDB } from "../../testutils/db/temp_db";
import { setupTempDB } from "../../testutils/fake_data/test_helpers";

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
