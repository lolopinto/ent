import { DateTime } from "luxon";
// these are needed to deal with SQLite having different types stored in the db vs the representation
// gotten back from the db/needed in ent land
// see Sqlite.execSync
export function convertDate(val: any): Date {
  if (typeof val === "string") {
    // try luxon first if in ISO format. If that doesn't work, fall back to Date.prse
    const dt = DateTime.fromISO(val);
    if (dt.isValid) {
      return dt.toJSDate();
    }
    return new Date(Date.parse(val));
  }
  // assume date
  return val;
}

export function convertNullableDate(val: any): Date | null {
  if (val === null) {
    return null;
  }
  return convertDate(val);
}

export function convertBool(val: any): boolean {
  if (typeof val === "number") {
    // assume 1 or 0
    return val != 0;
  }
  // assume boolean
  return val;
}

export function convertNullableBool(val: any): boolean | null {
  if (val === null) {
    return null;
  }
  return convertBool(val);
}

export function convertList<T>(val: any, conv?: (val: any) => T): T[] {
  if (Array.isArray(val)) {
    return val;
  }

  let res = JSON.parse(val);
  if (!conv) {
    return res;
  }
  if (!Array.isArray(res)) {
    throw new Error(`got a non-array from the db: ${val}`);
  }
  for (let i = 0; i < res.length; i++) {
    res[i] = conv(res[i]);
  }
  return res;
}
