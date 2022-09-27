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
    uniqKey: "fake_contacts_global",
    tableName: "fake_contacts",
    clause: Eq("user_id", ""),
    sortCol: "created_at",
    sqlite: true,
    orderby: "DESC",
    globalSchema: true,
  });
});

describe("custom query ASC", () => {
  commonTests({
    newQuery(viewer: Viewer, user: FakeUser) {
      return UserToContactsFkeyQueryAsc.query(viewer, user);
    },
    ml,
    uniqKey: "fake_contacts_global_asc",
    tableName: "fake_contacts",
    clause: Eq("user_id", ""),
    sortCol: "created_at",
    sqlite: true,
    orderby: "ASC",
    globalSchema: true,
  });
});

// TODO do we need more specific tests here?
// ent_custom_data.test.ts has a bunch and that may be enough
