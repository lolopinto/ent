import { Context, Viewer } from "../base";
import {
  FakeContact,
  FakeUser,
  UserToContactsFkeyQuery,
  UserToContactsFkeyQueryAsc,
  UserToContactsFkeyQueryDeletedAt,
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
    // TODO this is a global schema test, but we don't have a deleted_at column
    globalSchema: true,
    loadEnt: (v: Viewer, id: string) => FakeContact.loadXWithDeletedAt(v, id),
    loadRawData: (id: string, context?: Context) =>
      FakeContact.loadRawDataWithDeletedAt(id, context),
  });
});
// TODO
// and TODO more tests

// describe("custom query ASC", () => {
//   commonTests({
//     newQuery(viewer: Viewer, user: FakeUser) {
//       return UserToContactsFkeyQueryAsc.query(viewer, user);
//     },
//     ml,
//     uniqKey: "fake_contacts_global_asc",
//     tableName: "fake_contacts",
//     clause: Eq("user_id", ""),
//     sqlite: true,
//     orderby: [
//       {
//         column: "created_at",
//         direction: "ASC",
//       },
//     ],
//     globalSchema: true,
//   });
// });

// TODO do we need more specific tests here?
// ent_custom_data.test.ts has a bunch and that may be enough
