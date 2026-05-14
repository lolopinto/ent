import {
  EditRowOptions,
  Data,
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
import DB, { Client, Dialect, SyncClient } from "../core/db";

function isSyncClient(client: Client): client is SyncClient {
  return (client as SyncClient).execSync !== undefined;
}

function releaseError(err: unknown): Error | boolean {
  return err instanceof Error ? err : true;
}

export async function createRowForTest(
  options: CreateRowOptions,
  suffix?: string,
): Promise<Data | null> {
  let client: Client;
  if (Dialect.SQLite === DB.getDialect()) {
    client = DB.getInstance().getSQLiteClient();
  } else {
    client = await DB.getInstance().getNewClient();
  }

  let err: unknown;
  let hadErr = false;
  try {
    if (isSyncClient(client)) {
      return createRowSync(client, options, suffix || "");
    }
    return createRow(client, options, suffix || "");
  } catch (e) {
    err = e;
    hadErr = true;
    throw e;
  } finally {
    client.release(hadErr ? releaseError(err) : undefined);
  }
}

export async function editRowForTest(options: EditRowOptions, suffix?: string) {
  const client = await DB.getInstance().getNewClient();

  let err: unknown;
  let hadErr = false;
  try {
    if (isSyncClient(client)) {
      return editRowSync(client, options, suffix || "");
    }
    return editRow(client, options, suffix);
  } catch (e) {
    err = e;
    hadErr = true;
    throw e;
  } finally {
    client.release(hadErr ? releaseError(err) : undefined);
  }
}

export async function deleteRowsForTest(
  options: DataOptions,
  cls: clause.Clause,
) {
  const client = await DB.getInstance().getNewClient();

  let err: unknown;
  let hadErr = false;
  try {
    if (isSyncClient(client)) {
      return deleteRowsSync(client, options, cls);
    }
    return deleteRows(client, options, cls);
  } catch (e) {
    err = e;
    hadErr = true;
    throw e;
  } finally {
    client.release(hadErr ? releaseError(err) : undefined);
  }
}
