import { QueryRecorder } from "../../testutils/db_mock";
import { Viewer } from "../base";
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
  where: "user_id = $1",
  sortCol: "created_at",
  livePostgresDB: true, // doing this on a db as opposed to in memory
});
