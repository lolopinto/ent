import { Context, Viewer } from "../base";
import {
  FakeContact,
  FakeContactSchemaWithDeletedAt,
  FakeUser,
  UserToContactsFkeyQuery,
  UserToContactsFkeyQueryAsc,
  UserToContactsFkeyQueryDeletedAt,
  UserToContactsFkeyQueryDeletedAtAsc,
} from "../../testutils/fake_data/index";
import { commonTests } from "./shared_test";
import { MockLogs } from "../../testutils/mock_log";
import * as clause from "../clause";

const ml = new MockLogs();
ml.mock();

describe("custom query", () => {
  commonTests({
    newQuery(viewer: Viewer, user: FakeUser) {
      return UserToContactsFkeyQueryDeletedAt.query(viewer, user);
    },
    ml,
    uniqKey: "fake_contacts_global",
    tableName: "fake_contacts",
    clause: clause.And(clause.Eq("user_id", ""), clause.Eq("deleted_at", null)),
    sqlite: true,
    orderby: [
      {
        column: "created_at",
        direction: "DESC",
      },
    ],
    globalSchema: true,
    loadEnt: (v: Viewer, id: string) => FakeContact.loadXWithDeletedAt(v, id),
    loadRawData: (id: string, context?: Context) =>
      FakeContact.loadRawDataWithDeletedAt(id, context),
    contactSchemaForDeletionTest: FakeContactSchemaWithDeletedAt,
  });
});

describe("custom query ASC", () => {
  commonTests({
    newQuery(viewer: Viewer, user: FakeUser) {
      return UserToContactsFkeyQueryDeletedAtAsc.query(viewer, user);
    },
    ml,
    uniqKey: "fake_contacts_global_asc",
    tableName: "fake_contacts",
    clause: clause.And(clause.Eq("user_id", ""), clause.Eq("deleted_at", null)),
    sqlite: true,
    orderby: [
      {
        column: "created_at",
        direction: "ASC",
      },
    ],
    globalSchema: true,
    loadEnt: (v: Viewer, id: string) => FakeContact.loadXWithDeletedAt(v, id),
    loadRawData: (id: string, context?: Context) =>
      FakeContact.loadRawDataWithDeletedAt(id, context),
    contactSchemaForDeletionTest: FakeContactSchemaWithDeletedAt,
  });
});

// TODO do we need more specific tests here?
// ent_custom_data.test.ts has a bunch and that may be enough
