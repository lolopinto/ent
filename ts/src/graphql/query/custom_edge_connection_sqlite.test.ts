import { setupSqlite } from "../../testutils/db/temp_db";
import {
  FakeUser,
  UserToContactsFkeyQueryDeprecated,
} from "../../testutils/fake_data/index";
import {
  createEdges,
  tempDBTables,
} from "../../testutils/fake_data/test_helpers";
import { commonTests } from "./shared_edge_connection";

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
