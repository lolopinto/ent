import { Viewer } from "../base";
import { FakeUser, UserToContactsQuery } from "../../testutils/fake_data/index";
import { tempDBTables } from "../../testutils/fake_data/test_helpers";
import { commonTests } from "./shared_test";
import { assocTests } from "./shared_assoc_test";
import { setupSqlite } from "../../testutils/db/test_db";

commonTests({
  newQuery(viewer: Viewer, user: FakeUser) {
    return UserToContactsQuery.query(viewer, user);
  },
  tableName: "user_to_contacts_table",
  entsLength: 2,
  where: "id1 = ? AND edge_type = ?",
  sortCol: "time",
  sqlite: true,
});

describe("custom assoc", () => {
  // DB.getInstance is broken. so we need the same assoc instance to be used
  //  setupSqlite(`sqlite:///assoc_query_sqlite.db`, tempDBTables);

  // TODO there's a weird dependency with commonTest above where commenting that out breaks this...
  assocTests();
});
