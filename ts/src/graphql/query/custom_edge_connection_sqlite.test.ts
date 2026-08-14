import { setupSqlite } from "../../testutils/db/temp_db.js";
import {
  FakeUser,
  UserToContactsFkeyQueryDeprecated,
} from "../../testutils/fake_data/index.js";
import {
  createEdges,
  tempDBTables,
} from "../../testutils/fake_data/test_helpers.js";
import { commonTests } from "./shared_edge_connection.js";

beforeEach(async () => {
  await createEdges();
});

setupSqlite(`sqlite:///custom_edge_connection.db`, tempDBTables);
commonTests({
  getQuery: (v, user: FakeUser) =>
    UserToContactsFkeyQueryDeprecated.query(v, user),
  tableName: "fake_contacts",
  sortCol: "created_at",
});
