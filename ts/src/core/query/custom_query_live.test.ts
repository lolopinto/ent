import { QueryRecorder } from "../../testutils/db_mock";
import { Data, Viewer } from "../ent";
import DB from "../db";
import {
  FakeUser,
  UserToContactsFkeyQuery,
} from "../../testutils/fake_data/index";
import { createEdges } from "../../testutils/fake_data/test_helpers";
import { commonTests } from "./shared_test";

beforeEach(async () => {
  QueryRecorder.clear();
  // TODO figure out why this failed in the absence of this and have it fail loudly...
  //  await createEdges();
  QueryRecorder.clearQueries();
});

// afterAll(async () => {
//   await DB.getInstance().endPool();
// });

commonTests({
  newQuery(viewer: Viewer, user: FakeUser) {
    return UserToContactsFkeyQuery.query(viewer, user);
  },
  tableName: "fake_contacts",
  getFilterFn(user: FakeUser) {
    return function(row: Data) {
      return row.user_id === user.id;
    };
  },
  where: "user_id = $1",
  sortCol: "created_at",
  liveDB: true, // doing this on a db
});
