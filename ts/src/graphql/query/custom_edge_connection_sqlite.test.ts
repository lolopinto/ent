import { setupSqlite } from "../../testutils/db/test_db";
import {
  FakeUser,
  UserToContactsFkeyQuery,
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
  getQuery: (v, user: FakeUser) => UserToContactsFkeyQuery.query(v, user),
  tableName: "fake_contacts",
  sortCol: "created_at",
});
