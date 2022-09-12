import { Viewer } from "../base";
import {
  FakeUser,
  UserToContactsFkeyQuery,
  UserToContactsFkeyQueryDeprecated,
} from "../../testutils/fake_data/index";
import { commonTests } from "./shared_test";

describe("custom query deprecated", () => {
  commonTests({
    newQuery(viewer: Viewer, user: FakeUser) {
      return UserToContactsFkeyQueryDeprecated.query(viewer, user);
    },
    uniqKey: "fake_contacts",
    tableName: "fake_contacts",
    where: "user_id = ?",
    sortCol: "created_at",
    sqlite: true,
  });
});

describe("custom query", () => {
  commonTests({
    newQuery(viewer: Viewer, user: FakeUser) {
      return UserToContactsFkeyQuery.query(viewer, user);
    },
    uniqKey: "fake_contacts",
    tableName: "fake_contacts",
    where: "user_id = ?",
    sortCol: "created_at",
    sqlite: true,
  });
});
