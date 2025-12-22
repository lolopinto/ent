import { TempDB } from "../../testutils/db/temp_db.js";

import { FakeUser, FakeContact } from "../../testutils/fake_data/index.js";
import { setupTempDB } from "../../testutils/fake_data/test_helpers.js";
import { commonTests } from "./shared_edge_connection.js";
import { CustomClauseQuery } from "../../core/query/custom_clause_query.js";
import * as clause from "../../core/clause.js";

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
