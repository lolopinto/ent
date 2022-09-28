import { TempDB } from "../../testutils/db/temp_db";

import {
  FakeUser,
  UserToContactsFkeyQueryDeprecated,
} from "../../testutils/fake_data/index";
import { setupTempDB } from "../../testutils/fake_data/test_helpers";
import { commonTests } from "./shared_edge_connection";

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
