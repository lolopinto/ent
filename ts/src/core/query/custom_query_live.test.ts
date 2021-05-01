import { QueryRecorder } from "../../testutils/db_mock";
import { Data, Viewer } from "../base";
import {
  FakeUser,
  UserToContactsFkeyQuery,
} from "../../testutils/fake_data/index";
import { commonTests } from "./shared_test";

beforeEach(async () => {
  QueryRecorder.clear();
});

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
