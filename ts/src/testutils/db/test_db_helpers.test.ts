import { ID, Ent, Data, Viewer } from "../../core/base";
import { AlwaysAllowPrivacyPolicy } from "../../core/privacy";
import {
  getBuilderSchemaFromFields,
  getSchemaName,
  getTableName,
} from "../builder";
import { getSchemaTable } from "./test_db";
import { Dialect } from "../../core/db";

class Account implements Ent {
  id: ID;
  accountID: string;
  nodeType = "Account";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, public data: Data) {
    this.id = data.id;
  }
}

const AccountSchema = getBuilderSchemaFromFields({}, Account);

test("schema name", () => {
  expect(getSchemaName(AccountSchema)).toBe("Account");
});

test("table name", () => {
  expect(getTableName(AccountSchema)).toBe("accounts");
});

test("fields", () => {
  const table = getSchemaTable(AccountSchema, Dialect.Postgres);
  expect(table.name).toBe("accounts");
  expect(table.columns.length).toBe(3);
  expect(table.columns.map((col) => col.name)).toEqual([
    "id",
    "created_at",
    "updated_at",
  ]);
});
