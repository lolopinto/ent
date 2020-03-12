import DB from "./db";
import {
  EntPrivacyError,
  applyPrivacyPolicy,
  applyPrivacyPolicyX,
  PrivacyPolicy,
} from "./privacy";

export interface Viewer {
  viewerID: ID | null;
  viewer: () => Promise<Ent | null>;
  instanceKey: () => string;
}

export interface Ent {
  id: ID;
  viewer: Viewer;
  privacyPolicy: PrivacyPolicy;
}

export interface EntConstructor<T extends Ent> {
  new (viewer: Viewer, id: ID, options: {}): T;
}

export type ID = string | number;

interface Options<T> {
  // TODO pool or client later since we should get it from there
  // TODO this can be passed in for scenarios where we are not using default configuration
  //  clientConfig?: ClientConfig;
  tableName: string;
}

interface LoadableEntOptions<T extends Ent> extends Options<T> {
  ent: EntConstructor<T>;
}

// TODO these will change when ability to read/edit non-ents is added
export interface LoadEntOptions<T extends Ent> extends LoadableEntOptions<T> {
  // list of fields to edit
  fields: string[];
}

export interface EditEntOptions<T extends Ent> extends LoadableEntOptions<T> {
  // fields to be edited
  fields: {};
}

export async function loadEnt<T extends Ent>(
  viewer: Viewer,
  id: ID,
  options: LoadEntOptions<T>,
): Promise<T | null> {
  const ent = await loadRow(viewer, id, options);
  return await applyPrivacyPolicyForEnt(viewer, ent);
}

export async function loadDerivedEnt<T extends Ent>(
  viewer: Viewer,
  data: {},
  loader: new (viewer: Viewer, data: {}) => T,
): Promise<T | null> {
  const ent = new loader(viewer, data);
  return await applyPrivacyPolicyForEnt(viewer, ent);
}

export async function loadDerivedEntX<T extends Ent>(
  viewer: Viewer,
  data: {},
  loader: new (viewer: Viewer, data: {}) => T,
): Promise<T> {
  const ent = new loader(viewer, data);
  return await applyPrivacyPolicyForEntX(viewer, ent);
}

async function applyPrivacyPolicyForEnt<T extends Ent>(
  viewer: Viewer,
  ent: T | null,
): Promise<T | null> {
  if (ent) {
    const visible = await applyPrivacyPolicy(viewer, ent.privacyPolicy, ent);
    if (visible) {
      return ent;
    }
  }
  return null;
}

async function applyPrivacyPolicyForEntX<T extends Ent>(
  viewer: Viewer,
  ent: T,
): Promise<T> {
  const visible = await applyPrivacyPolicyX(viewer, ent.privacyPolicy, ent);
  if (visible) {
    return ent;
  }
  throw new EntPrivacyError(ent.id);
}

export async function loadEntX<T extends Ent>(
  viewer: Viewer,
  id: ID,
  options: LoadEntOptions<T>,
): Promise<T> {
  const ent = await loadRowX(viewer, id, options);
  return await applyPrivacyPolicyForEntX(viewer, ent);
}

function logQuery(query: string) {
  //  console.log(query);
}

// TODO change this and loadRow to not return an ent or do anything with ent
export async function loadRowX<T extends Ent>(
  viewer: Viewer,
  id: ID,
  options: LoadEntOptions<T>,
): Promise<T> {
  const result = await loadRow(viewer, id, options);
  if (result == null) {
    throw new Error(`couldn't find row for id ${id}`);
  }
  return result;
}

export async function loadRow<T extends Ent>(
  viewer: Viewer,
  id: ID,
  options: LoadEntOptions<T>,
): Promise<T | null> {
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

  return new options.ent(viewer, id, res.rows[0]);
}

export async function createEnt<T extends Ent>(
  viewer: Viewer,
  options: EditEntOptions<T>,
): Promise<T | null> {
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

  let query = `INSERT INTO ${options.tableName} (${cols}) VALUES (${vals}) RETURNING *`;

  logQuery(query);

  const pool = DB.getInstance().getPool();
  try {
    const res = await pool.query(query, values);

    if (res.rowCount == 1) {
      // for now assume id primary key
      // todo
      let row = res.rows[0];
      return new options.ent(viewer, row.id, row);
    }
  } catch (e) {
    console.error(e);
    return null;
  }
  return null;
}

// column should be passed in here
export async function editEnt<T extends Ent>(
  viewer: Viewer,
  id: ID,
  options: EditEntOptions<T>,
): Promise<T | null> {
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

  let query = `UPDATE ${options.tableName} SET ${vals} WHERE id = $${idx} RETURNING *`;
  logQuery(query);

  try {
    const pool = DB.getInstance().getPool();
    const res = await pool.query(query, values);

    if (res.rowCount == 1) {
      // for now assume id primary key
      // TODO make this extensible as needed.
      let row = res.rows[0];
      return new options.ent(viewer, row.id, row);
    }
  } catch (e) {
    console.error(e);
    return null;
  }
  return null;
}

export async function deleteEnt<T extends Ent>(
  viewer: Viewer,
  id: ID,
  options: Options<T>,
): Promise<null> {
  let query = `DELETE FROM ${options.tableName} WHERE id = $1`;
  logQuery(query);

  try {
    const pool = DB.getInstance().getPool();
    await pool.query(query, [id]);
  } catch (e) {
    console.error(e);
  }
  return null;
}

enum EditOperation {
  Create = "create",
  Edit = "edit",
  Delete = "delete",
}
