// these are needed to deal with SQLite having different types stored in the db vs the representation
// gotten back from the db/needed in ent land
// see Sqlite.execSync
export function convertDate(val: any): Date {
  if (typeof val === "string") {
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
