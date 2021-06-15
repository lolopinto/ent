import { Field } from "../../schema";
import { BaseEntSchema } from "../../schema/base_schema";
import { ID, Ent, Data, Viewer } from "../../core/base";
import { AlwaysAllowPrivacyPolicy } from "../../core/privacy";
import { getSchemaName, getTableName } from "../builder";
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

class AccountSchema extends BaseEntSchema {
  ent = Account;
  fields: Field[] = [];
}

test("schema name", () => {
  expect(getSchemaName(new AccountSchema())).toBe("Account");
});

test("table name", () => {
  expect(getTableName(new AccountSchema())).toBe("accounts");
});

test("fields", () => {
  const table = getSchemaTable(new AccountSchema(), Dialect.Postgres);
  expect(table.name).toBe("accounts");
  expect(table.columns.length).toBe(3);
  expect(table.columns.map((col) => col.name)).toEqual([
    "id",
    "created_at",
    "updated_at",
  ]);
});
