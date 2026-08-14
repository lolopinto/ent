import {
  FakeUser,
  UserToContactsFkeyQuery,
  UserToContactsFkeyQueryAsc,
} from "../../testutils/fake_data/index.js";
import { MockLogs } from "../../testutils/mock_log.js";
import { Viewer } from "../base.js";
import { Eq } from "../clause.js";
import { commonTests } from "./shared_test.js";

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
        direction: "DESC",
      },
      {
        column: "id",
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
        direction: "ASC",
      },
      {
        column: "id",
        direction: "ASC",
      },
    ],
    sqlite: true,
  });
});
