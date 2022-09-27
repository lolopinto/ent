import { Client } from "pg";
import { Data } from "../../core/base";
import { getFields, getStorageKey, Schema } from "../../schema";
import { getDefaultValue } from "./value";
import { buildInsertQuery } from "../../core/ent";

interface Options {
  overrides?: Data;
  client: Client;
  tableName: string;
}

export async function writeFixture(schema: Schema, opts: Options) {
  const fields = getFields(schema);
  const d: Data = {};
  for (const [fieldName, field] of fields) {
    const col = getStorageKey(field, fieldName);
    const val = getDefaultValue(field, col);
    d[col] = val;
  }
  if (opts.overrides) {
    for (const k in opts.overrides) {
      d[k] = opts.overrides[k];
    }
  }

  const q = buildInsertQuery({
    tableName: opts.tableName,
    fields: d,
  });
  await opts.client.query(q[0], q[1]);
}
