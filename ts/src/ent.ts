import {Pool, ClientConfig} from "pg";

import DB from "./db";

export interface Ent {
  id: ID;
  // todo viewer 
  // todo privacy policy 
}

export interface EntConstructor {
  // TODO make this add viewer eventually
  new(id: ID, options:{});
}

export type ID = string | number;

interface Options<T> {
  // TODO pool or client later since we should get it from there
  // TODO this can be passed in for scenarios where we are not using default configuration
//  clientConfig?: ClientConfig;
  tableName: string;
}

interface LoadableEntOptions<T> extends Options<T> {
  ent: EntConstructor;
}

export interface LoadEntOptions<T> extends LoadableEntOptions<T> {
  // list of fields to edit
  fields: string[];
}

export interface EditEntOptions<T> extends LoadableEntOptions<T> {
  // fields to be edited
  fields: {};
}

// Todo viewer
export async function loadEnt<T>(id: ID, options: LoadEntOptions<T>): Promise<T | null> {
  return loadRow(id, options);
}

// todo viewer
export async function loadEntX<T>(id: ID, options: LoadEntOptions<T>): Promise<T> {
  return loadRowX(id, options);
}

async function loadRowX<T>(id: ID, options: LoadEntOptions<T>): Promise<T> {
  const result = await loadRow(id, options);
  if (result == null) {
    throw new Error(`couldn't find row for id ${id}`);
  }
  return result;
}

function logQuery(query: string) {
  console.log(query);
}

async function loadRow<T>(id: ID, options: LoadEntOptions<T>): Promise<T | null> {
  const pool = DB.getInstance().getPool();
  const fields = options.fields.join(", ");
  const query = `SELECT ${fields} FROM ${options.tableName} WHERE id = $1`;
  logQuery(query);
  const res = await pool.query(query, [id]);

  if (res.rowCount != 1) {
    if (res.rowCount > 1) {
      console.error("got more than one row for query " + query);
    }
    return null;
  }

  return new options.ent(id, res.rows[0]);
}

export async function createEnt<T>(options: EditEntOptions<T>): Promise<T | null> {
  let fields: string[] = [];
  let values: any[] = [];
  let valsString: string[] = [];
  let idx = 1;
  for (const key in options.fields) {
    fields.push(key);
    values.push(options.fields[key]);
    valsString.push(`$${idx}`);
    idx++;
  }

  const cols = fields.join(", ");
  const vals = valsString.join(", ");

  let query = `INSERT INTO ${options.tableName} (${cols}) VALUES (${vals}) RETURNING *`

  logQuery(query);

  const pool = DB.getInstance().getPool();
  try {
    const res = await pool.query(query, values);

    if (res.rowCount == 1) {
      // for now assume id primary key 
      // todo
      let row = res.rows[0];
      return new options.ent(row.id, row);
    }
  } catch(e) {
    console.error(e);
    return null;
  }
  return null;
}

// column should be passed in here
export async function editEnt<T>(id: ID, options: EditEntOptions<T>): Promise<T | null> {
  let valsString: string[] = [];
  let values: any[] = [];

  let idx = 1;
  for (const key in options.fields) {
    values.push(options.fields[key]);
    valsString.push(`${key} = $${idx}`);
    idx++;
  }
  values.push(id);

  const vals = valsString.join(", ");

  let query = `UPDATE ${options.tableName} SET ${vals} WHERE id = $${idx} RETURNING *`
  logQuery(query);

  try {
    const pool = DB.getInstance().getPool();
    const res = await pool.query(query, values);

    if (res.rowCount == 1) {
      // for now assume id primary key 
      // TODO make this extensible as needed.
      let row = res.rows[0];
      return new options.ent(row.id, row);
    }
  } catch(e) {
    console.error(e);
    return null;
  }
  return null;
}

export async function deleteEnt<T>(id: ID, options: Options<T>): Promise<null> {
  let query = `DELETE FROM ${options.tableName} WHERE id = $1`
  logQuery(query);

  try {
    const pool = DB.getInstance().getPool();
    await pool.query(query, [id]);
  } catch(e) {
    console.error(e);
  }
  return null;
}


enum EditOperation {
  Create = "create",
  Edit = "edit",
  Delete = "delete"
}