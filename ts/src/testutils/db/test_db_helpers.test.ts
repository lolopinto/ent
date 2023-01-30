import {
  BaseEnt,
  getBuilderSchemaFromFields,
  getSchemaName,
  getTableName,
} from "../builder";
import { getSchemaTable } from "./temp_db";
import { Dialect } from "../../core/db";

class Account extends BaseEnt {
  accountID: string;
  nodeType = "Account";
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
