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

export function convertJSONList(val: any): boolean[] {
  return convertList(val, convertJSON);
}

export function convertNullableJSONList(val: any): any[] | null {
  return convertNullableList(val, convertJSON);
}
