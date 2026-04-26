import { DateTime } from "luxon";

function isDateLike(
  val: any,
): val is { getTime(): number; toISOString?: () => string } {
  return !!val && typeof val === "object" && typeof val.getTime === "function";
}

export function parseDate(val: any, throwErr: (s: string) => Error): DateTime {
  let dt: DateTime;
  if (typeof val === "number") {
    dt = DateTime.fromMillis(val);
  } else if (typeof val === "string") {
    dt = DateTime.fromISO(val);
    if (!dt.isValid) {
      dt = DateTime.fromMillis(Date.parse(val));
    }
  } else if (val instanceof Date || isDateLike(val)) {
    dt = DateTime.fromJSDate(
      val instanceof Date ? val : new Date(val.getTime()),
    );
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
