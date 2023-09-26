import { Viewer } from "../base";
import {
  FakeUser,
  UserToContactsFkeyQuery,
  UserToContactsFkeyQueryAsc,
} from "../../testutils/fake_data/index";
import { commonTests } from "./shared_test";
import { MockLogs } from "../../testutils/mock_log";
import { Eq } from "../clause";

const ml = new MockLogs();
ml.mock();

describe("custom query", () => {
  commonTests({
    newQuery(viewer: Viewer, user: FakeUser) {
      return UserToContactsFkeyQuery.query(viewer, user);
    },
    ml,
    uniqKey: "fake_contacts",
    tableName: "fake_contacts",
    clause: Eq("user_id", ""),
    orderby: [
      {
        column: "created_at",
        // dateColumn: true,
        direction: "DESC",
      },
    ],
    sqlite: true,
  });
});

describe("custom query asc", () => {
  commonTests({
    newQuery(viewer: Viewer, user: FakeUser) {
      return UserToContactsFkeyQueryAsc.query(viewer, user);
    },
    ml,
    uniqKey: "fake_contacts_asc",
    tableName: "fake_contacts",
    clause: Eq("user_id", ""),
    orderby: [
      {
        column: "created_at",
        dateColumn: true,
        direction: "ASC",
      },
    ],
    sqlite: true,
  });
});
