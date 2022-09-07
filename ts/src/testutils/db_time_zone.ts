import { DateTime } from "luxon";
import { leftPad } from "../schema";
import DB from "../core/db";

let dbCurrentZone: string | null | undefined = undefined;
export class DBTimeZone {
  private static async getVal(): Promise<string | null> {
    if (dbCurrentZone !== undefined) {
      return dbCurrentZone;
    }

    const r = await DB.getInstance()
      .getPool()
      .query("SELECT current_setting('TIMEZONE');");

    if (r.rows.length) {
      dbCurrentZone = r.rows[0].current_setting as string;
    } else {
      dbCurrentZone = null;
    }
    return dbCurrentZone;
  }

  static async getDateOffset(d: Date) {
    let zone = await DBTimeZone.getVal();

    let dt = DateTime.fromJSDate(d);
    if (zone) {
      dt = dt.setZone(zone);
    }

    // use
    const val = leftPad(dt.get("offset") / 60);

    if (val == "00") {
      return "+00";
    }
    return val;
  }
}
