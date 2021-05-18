import {
  EditRowOptions,
  Data,
  ID,
  DataOptions,
  CreateRowOptions,
} from "../core/base";
import { createRow, editRow, deleteRows } from "../core/ent";
import * as clause from "../core/clause";
import DB from "../core/db";

export async function createRowForTest(
  options: CreateRowOptions,
  suffix?: string,
): Promise<Data | null> {
  const client = await DB.getInstance().getNewClient();

  try {
    return await createRow(client, options, suffix || "");
  } finally {
    client.release();
  }
}

export async function editRowForTest(
  options: EditRowOptions,
  id: ID,
  suffix?: string,
) {
  const client = await DB.getInstance().getNewClient();

  try {
    return await editRow(client, options, id, suffix);
  } finally {
    client.release();
  }
}

export async function deleteRowsForTest(
  options: DataOptions,
  cls: clause.Clause,
) {
  const client = await DB.getInstance().getNewClient();

  try {
    return await deleteRows(client, options, cls);
  } finally {
    client.release();
  }
}
