import { DateTime } from "luxon";

export function parseDate(val: any, throwErr: (s: string) => Error): DateTime {
  let dt: DateTime;
  if (typeof val === "number") {
    dt = DateTime.fromMillis(val);
  } else if (typeof val === "string") {
    dt = DateTime.fromISO(val);
    if (!dt.isValid) {
      dt = DateTime.fromMillis(Date.parse(val));
    }
  } else if (val instanceof Date) {
    dt = DateTime.fromJSDate(val);
  } else if (val instanceof DateTime) {
    dt = val;
  } else {
    throw throwErr(`invalid input for type Time ${val}`);
  }
  if (!dt.isValid) {
    throw throwErr(`invalid input for type Time ${val}`);
  }
  return dt;
}
