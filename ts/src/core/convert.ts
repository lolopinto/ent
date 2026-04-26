import pg from "pg";
import { DateTime } from "luxon";

const TEXT_ARRAY_OID = 1009;
const parseTextArray = pg.types.getTypeParser(TEXT_ARRAY_OID as any);

function normalizeArrayLikeObject(val: any): any[] {
  // This only runs for list-typed fields. Bun's native Postgres client can return
  // some arrays as `{0: ..., 1: ...}` objects instead of real JS arrays.
  const keys = Object.keys(val);
  if (!keys.length) {
    return [];
  }
  if (keys.every((key) => /^\d+$/.test(key))) {
    return keys
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .map((key) => val[key]);
  }
  throw new Error(`got a non-array from the db: ${JSON.stringify(val)}`);
}

export function convertDBDate(val: any): string {
  if (typeof val === "string") {
    return val.slice(0, 10);
  }
  const dt = DateTime.fromJSDate(new Date(val), { zone: "utc" });
  if (dt.isValid) {
    const date = dt.toISODate();
    if (date) {
      return date;
    }
  }
  return new Date(val).toISOString().slice(0, 10);
}

export function convertNullableDBDate(val: any): string | null {
  if (val === null || val === undefined) {
    return null;
  }
  return convertDBDate(val);
}

export function convertDBDateList(val: any): string[] {
  return convertList(val, convertDBDate);
}

export function convertNullableDBDateList(val: any): string[] | null {
  return convertNullableList(val, convertDBDate);
}

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
  let res: any;
  if (Array.isArray(val)) {
    res = [...val];
  } else if (val && typeof val === "object") {
    res = normalizeArrayLikeObject(val);
  } else {
    try {
      res = JSON.parse(val);
    } catch (err) {
      if (typeof val === "string" && val.startsWith("{") && val.endsWith("}")) {
        res = parseTextArray(val);
      } else {
        throw err;
      }
    }
  }
  if (res && typeof res === "object" && !Array.isArray(res)) {
    res = normalizeArrayLikeObject(res);
  }
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

export function convertNullableList<T>(
  val: any,
  conv?: (val: any) => T,
): T[] | null {
  // undefined can happen with unsafe ents
  if (val === null || val === undefined) {
    return null;
  }
  return convertList(val, conv);
}

export function convertDateList(val: any): Date[] {
  return convertList(val, convertDate);
}

export function convertNullableDateList(val: any): Date[] | null {
  return convertNullableList(val, convertDate);
}

export function convertBoolList(val: any): boolean[] {
  return convertList(val, convertBool);
}

export function convertNullableBoolList(val: any): boolean[] | null {
  return convertNullableList(val, convertBool);
}

export function convertJSON(val: any): any {
  if (typeof val === "string") {
    return JSON.parse(val);
  }
  return val;
}

export function convertNullableJSON(val: any): any | null {
  if (val === null) {
    return val;
  }
  return convertJSON(val);
}

export function convertJSONList(val: any): any[] {
  return convertList(val, convertJSON);
}

export function convertNullableJSONList(val: any): any[] | null {
  return convertNullableList(val, convertJSON);
}

export function convertTextToBuffer(val: any): Buffer {
  if (typeof val === "string") {
    return Buffer.from(val, "base64");
  }
  return val;
}

export function convertNullableTextToBuffer(val: any): Buffer {
  if (val == null) {
    return val;
  }
  return convertTextToBuffer(val);
}
