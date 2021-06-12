import {
  EditRowOptions,
  Data,
  ID,
  DataOptions,
  CreateRowOptions,
} from "../core/base";
import {
  createRow,
  editRow,
  deleteRows,
  createRowSync,
  editRowSync,
  deleteRowsSync,
} from "../core/ent";
import * as clause from "../core/clause";
import DB, { Sqlite, SyncQueryer } from "../core/db";

export async function createRowForTest(
  options: CreateRowOptions,
  suffix?: string,
): Promise<Data | null> {
  const client = await DB.getInstance().getNewClient();

  try {
    if (client instanceof Sqlite) {
      return createRowSync(client, options, suffix || "");
    }
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
    // TODO instanceof Sqlite is terrible here
    if (client instanceof Sqlite) {
      return editRowSync(client, options, id, suffix || "");
    }
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
    if (client instanceof Sqlite) {
      return deleteRowsSync(client, options, cls);
    }
    return await deleteRows(client, options, cls);
  } finally {
    client.release();
  }
}
