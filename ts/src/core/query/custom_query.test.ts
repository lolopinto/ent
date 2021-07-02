import { Pool } from "pg";
import { QueryRecorder } from "../../testutils/db_mock";
import { Viewer } from "../base";
import {
  FakeUser,
  UserToContactsFkeyQuery,
} from "../../testutils/fake_data/index";
import { createEdges } from "../../testutils/fake_data/test_helpers";
import { commonTests } from "./shared_test";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

beforeEach(async () => {
  QueryRecorder.clear();
  // TODO figure out why this failed in the absence of this and have it fail loudly...
  await createEdges();
  QueryRecorder.clearQueries();
});

commonTests({
  newQuery(viewer: Viewer, user: FakeUser) {
    return UserToContactsFkeyQuery.query(viewer, user);
  },
  tableName: "fake_contacts",
  where: "user_id = $1",
  sortCol: "created_at",
});
