import { TempDB } from "../../testutils/db/temp_db.js";

import {
  FakeUser,
  UserToContactsFkeyQueryDeprecated,
} from "../../testutils/fake_data/index.js";
import { setupTempDB } from "../../testutils/fake_data/test_helpers.js";
import { commonTests } from "./shared_edge_connection.js";

let tdb: TempDB;

beforeAll(async () => {
  tdb = await setupTempDB();
});

afterAll(async () => {
  await tdb.afterAll();
});

commonTests({
  getQuery: (v, user: FakeUser) =>
    UserToContactsFkeyQueryDeprecated.query(v, user),
  tableName: "fake_contacts",
  sortCol: "created_at",
});
