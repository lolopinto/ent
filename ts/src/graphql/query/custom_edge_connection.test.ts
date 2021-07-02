import { Pool } from "pg";
import { QueryRecorder } from "../../testutils/db_mock";

import {
  FakeUser,
  UserToContactsFkeyQuery,
} from "../../testutils/fake_data/index";
import { createEdges } from "../../testutils/fake_data/test_helpers";
import { commonTests } from "./shared_edge_connection";
jest.mock("pg");
QueryRecorder.mockPool(Pool);

beforeEach(async () => {
  QueryRecorder.clear();
  await createEdges();
  QueryRecorder.clearQueries();
});

commonTests({
  getQuery: (v, user: FakeUser) => UserToContactsFkeyQuery.query(v, user),
  tableName: "fake_contacts",
  sortCol: "created_at",
});
