import { TempDB } from "../../testutils/db/temp_db";

import { FakeUser, FakeContact } from "../../testutils/fake_data/index";
import { setupTempDB } from "../../testutils/fake_data/test_helpers";
import { commonTests } from "./shared_edge_connection";
import { CustomClauseQuery } from "../../core/query/custom_clause_query";
import * as clause from "../../core/clause";

let tdb: TempDB;

beforeAll(async () => {
  tdb = await setupTempDB();
});

afterAll(async () => {
  await tdb.afterAll();
});

commonTests({
  getQuery: (v, user: FakeUser) =>
    new CustomClauseQuery(v, {
      loadEntOptions: FakeContact.loaderOptions(),
      clause: clause.Eq("user_id", user.id),
      name: "userToContacts",
      orderby: [
        {
          column: "created_at",
          direction: "DESC",
        },
      ],
    }),
  tableName: "fake_contacts",
  sortCol: "created_at",
});
