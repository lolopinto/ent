import {
  EditRowOptions,
  Data,
  ID,
  createRow,
  editRow,
  deleteRows,
  DataOptions,
} from "../core/ent";
import * as clause from "../core/clause";
import DB from "../core/db";
import { snakeCase } from "snake-case";
import { QueryRecorder } from "./db_mock";

export async function createRowForTest(
  options: EditRowOptions,
  suffix?: string,
): Promise<Data | null> {
  const client = await DB.getInstance().getNewClient();

  return await createRow(client, options, suffix || "");
}

export async function editRowForTest(
  options: EditRowOptions,
  id: ID,
  suffix?: string,
) {
  const client = await DB.getInstance().getNewClient();

  return await editRow(client, options, id, suffix);
}

export async function deleteRowsForTest(
  options: DataOptions,
  cls: clause.Clause,
) {
  const client = await DB.getInstance().getNewClient();

  return await deleteRows(client, options, cls);
}

export function snakeAll(data: Data, addDefaultFields: boolean): Data {
  let ret: Data = {};
  for (const key in data) {
    ret[snakeCase(key)] = data[key];
  }
  if (addDefaultFields) {
    ret.id = QueryRecorder.newID();
    ret.created_at = new Date();
    ret.updated_at = new Date();
  }
  return ret;
}
