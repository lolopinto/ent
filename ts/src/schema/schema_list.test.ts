import { LoggedOutViewer } from "../core/viewer";
import {
  BooleanListType,
  DateListType,
  EnumListType,
  FloatListType,
  IntegerListType,
  StringListType,
  StringType,
  TimeListType,
  TimeType,
  TimestamptzListType,
  UUIDType,
  IntegerType,
  BooleanType,
} from "./field";
import {
  JSONBListType,
  JSONBTypeAsList,
  JSONListType,
  JSONTypeAsList,
} from "./json_field";
import Schema from "./schema";
import { User, SimpleAction, BuilderSchema } from "../testutils/builder";
import { TempDB, getSchemaTable } from "../testutils/db/temp_db";
import { v4 } from "uuid";
import DB, { Dialect } from "../core/db";
import { Ent } from "../core/base";
import * as fs from "fs";
import { loadConfig } from "../core/config";
import {
  convertBool,
  convertDate,
  convertList,
  convertJSON,
} from "../core/convert";
import { WriteOperation } from "../action";
import { StructTypeAsList } from "./struct_field";
let tdb: TempDB;

async function setupTempDB(dialect: Dialect, connString?: string) {
  beforeAll(async () => {
    if (connString) {
      process.env.DB_CONNECTION_STRING = connString;
    } else {
      delete process.env.DB_CONNECTION_STRING;
    }
    loadConfig();
    tdb = new TempDB(dialect);
    await tdb.beforeAll();
  });

  afterAll(async () => {
    await tdb.afterAll();

    if (Dialect.SQLite === dialect) {
      fs.rmSync(tdb.getSqliteClient().name);
    }
  });

  afterEach(async () => {
    await tdb.dropAll();
  });
}

async function createTables(...schemas: BuilderSchema<Ent>[]) {
  for (const schema of schemas) {
    await tdb.create(getSchemaTable(schema, DB.getDialect()));
  }
}

function getInsertAction<T extends Ent>(
  schema: BuilderSchema<T>,
  map: Map<string, any>,
) {
  return new SimpleAction(
    new LoggedOutViewer(),
    schema,
    map,
    WriteOperation.Insert,
    null,
  );
}

describe("postgres", () => {
  setupTempDB(Dialect.Postgres);
  commonTests();
});

describe("sqlite", () => {
  setupTempDB(Dialect.SQLite, `sqlite:///schema_live.db`);
  commonTests();
});

function commonTests() {
  test("string list", async () => {
    class Account extends User {}
    class AccountSchema implements Schema {
      fields = {
        Nicknames: StringListType(),
      };
      ent = Account;
    }

    const n = ["Lord Snow", "The Prince That was Promised"];

    const action = getInsertAction(
      new AccountSchema(),
      new Map<string, any>([["Nicknames", n]]),
    );
    await createTables(new AccountSchema());

    const account = await action.saveX();
    expect(convertList(account.data.nicknames)).toEqual(n);
  });

  test("string list with empty value at end", async () => {
    class Account extends User {}
    class AccountSchema implements Schema {
      fields = {
        Nicknames: StringListType(),
      };
      ent = Account;
    }

    const n = ["Lord Snow", "The Prince That was Promised", ""];

    const action = getInsertAction(
      new AccountSchema(),
      new Map<string, any>([["Nicknames", n]]),
    );
    await createTables(new AccountSchema());

    const account = await action.saveX();
    expect(convertList(account.data.nicknames)).toEqual(n);
  });

  test("string list with empty value mixed in ", async () => {
    class Account extends User {}
    class AccountSchema implements Schema {
      fields = {
        Nicknames: StringListType(),
      };
      ent = Account;
    }

    const n = ["Lord Snow", "", "The Prince That was Promised"];

    const action = getInsertAction(
      new AccountSchema(),
      new Map<string, any>([["Nicknames", n]]),
    );
    await createTables(new AccountSchema());

    const account = await action.saveX();
    expect(convertList(account.data.nicknames)).toEqual(n);
  });

  test("formatted string list", async () => {
    class CountryCode extends User {}
    class CountryCodeSchema implements Schema {
      fields = {
        codes: StringListType({ toLowerCase: true }),
      };
      ent = CountryCode;
    }

    const input = ["US", "Uk", "fr"];
    const output = input.map((f) => f.toLowerCase());

    const action = getInsertAction(
      new CountryCodeSchema(),
      new Map<string, any>([["codes", input]]),
    );
    await createTables(new CountryCodeSchema());

    const codes = await action.saveX();
    expect(convertList(codes.data.codes)).toEqual(output);
  });

  test("int list", async () => {
    class Lottery extends User {}
    class LotterySchema implements Schema {
      fields = {
        numbers: IntegerListType(),
      };
      ent = Lottery;
    }

    const n = [4, 8, 15, 16, 23, 42];

    const action = getInsertAction(
      new LotterySchema(),
      new Map<string, any>([["numbers", n]]),
    );
    await createTables(new LotterySchema());

    const lottery = await action.saveX();
    expect(convertList(lottery.data.numbers)).toEqual(n);
  });

  test("float list", async () => {
    class TempHistory extends User {}
    class TempHistorySchema implements Schema {
      fields = {
        temps: FloatListType(),
      };
      ent = TempHistory;
    }

    const n = [98.0, 97.6, 93.2, 92.1];

    const action = getInsertAction(
      new TempHistorySchema(),
      new Map<string, any>([["temps", n]]),
    );
    await createTables(new TempHistorySchema());

    const temp = await action.saveX();
    expect(convertList(temp.data.temps)).toEqual(n);
  });

  test("date list", async () => {
    class Holiday extends User {}
    class HolidaySchema implements Schema {
      fields = {
        id: UUIDType(),
        country: StringType(),
        holidays: DateListType(),
      };
      ent = Holiday;
    }

    const holidays = ["2020-12-25", "2020-12-26", "2021-01-01"];
    const expected = holidays.map(convertDate);

    const action = getInsertAction(
      new HolidaySchema(),
      new Map<string, any>([
        ["id", v4()],
        ["holidays", holidays],
        ["country", "US"],
      ]),
    );
    await createTables(new HolidaySchema());

    const hol = await action.saveX();
    expect(convertList(hol.data.holidays, convertDate)).toEqual(expected);
  });

  test("time list", async () => {
    class Appointment extends User {}
    class AppointmentSchema implements Schema {
      fields = {
        availableTimes: TimeListType(),
      };
      ent = Appointment;
    }

    // TODO we don't support complicated time formats...
    const times = ["08:00:00", "10:00:00", "11:30:00"];

    const action = getInsertAction(
      new AppointmentSchema(),
      new Map<string, any>([["availableTimes", times]]),
    );
    await createTables(new AppointmentSchema());

    const appt = await action.saveX();
    expect(convertList(appt.data.available_times)).toEqual(times);
  });

  test("time via date list", async () => {
    class Appointment extends User {}
    class AppointmentSchema implements Schema {
      fields = {
        availableTimes: TimeListType(),
      };
      ent = Appointment;
    }

    const newDate = (
      hours: number,
      mins?: number,
      secs?: number,
      msec?: number,
    ) => {
      const date = new Date();
      date.setHours(hours, mins || 0, secs || 0, msec || 0);
      return date;
    };

    const times = [newDate(8), newDate(10), newDate(11, 30)];
    const expected = times.map((time) => TimeType().format(time));

    const action = getInsertAction(
      new AppointmentSchema(),
      new Map<string, any>([["availableTimes", times]]),
    );
    await createTables(new AppointmentSchema());

    const appt = await action.saveX();
    expect(convertList(appt.data.available_times)).toEqual(expected);
  });

  test("boolean list", async () => {
    class Survey extends User {}
    class SurveySchema implements Schema {
      fields = {
        satisfied: BooleanListType(),
      };
      ent = Survey;
    }

    const satisfied = [true, false, true];

    const action = getInsertAction(
      new SurveySchema(),
      new Map<string, any>([["satisfied", satisfied]]),
    );
    await createTables(new SurveySchema());

    const appt = await action.saveX();
    expect(convertList(appt.data.satisfied, convertBool)).toEqual(satisfied);
  });

  // not dealing with timestamp list idiosyncracies here...
  // sqlite will do the "wrong" thing
  test("timestamptz list", async () => {
    class Visit extends User {}
    class VisitSchema implements Schema {
      fields = {
        visits: TimestamptzListType(),
      };
      ent = Visit;
    }

    const visits = [
      "2020-12-25T00:00:00.000Z",
      "2020-12-26T00:00:00.000Z",
      "2021-01-01T00:00:00.000Z",
    ];
    const expected = visits.map(convertDate);

    const action = getInsertAction(
      new VisitSchema(),
      new Map<string, any>([["visits", visits]]),
    );
    await createTables(new VisitSchema());

    const visitss = await action.saveX();
    expect(convertList(visitss.data.visits, convertDate)).toEqual(expected);
  });

  class Available extends User {}
  class AvailableSchema implements Schema {
    fields = {
      days: EnumListType({
        values: [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
      }),
    };
    ent = Available;
  }

  test("enum list", async () => {
    const weekend = ["Saturday", "Sunday"];

    const action = getInsertAction(
      new AvailableSchema(),
      new Map<string, any>([["days", weekend]]),
    );
    await createTables(new AvailableSchema());

    const days = await action.saveX();
    expect(convertList(days.data.days)).toEqual(weekend);
  });

  test("invalid enum value", async () => {
    const weekend = ["red", "Tuesday"];

    const action = getInsertAction(
      new AvailableSchema(),
      new Map<string, any>([["days", weekend]]),
    );
    await createTables(new AvailableSchema());

    try {
      await action.saveX();
      throw new Error("should have thrown");
    } catch (err) {
      expect(err.message).toBe("invalid field days with value red,Tuesday");
    }
  });

  test("list validation. minLen", async () => {
    const t = IntegerListType().minLen(2);

    expect(await t.valid([1, 2, 3])).toBe(true);
    expect(await t.valid([1, 2])).toBe(true);
    expect(await t.valid([1])).toBe(false);
  });

  test("list validation. maxLen", async () => {
    const t = IntegerListType().maxLen(2);

    expect(await t.valid([1, 2, 3])).toBe(false);
    expect(await t.valid([1, 2])).toBe(true);
    expect(await t.valid([1])).toBe(true);
  });

  test("list validation. length", async () => {
    const t = IntegerListType().length(2);

    expect(await t.valid([1, 2, 3])).toBe(false);
    expect(await t.valid([1, 2])).toBe(true);
    expect(await t.valid([1])).toBe(false);
  });

  test("list validation. range", async () => {
    const t = IntegerListType().range(2, 10);

    expect(await t.valid([1, 2, 3])).toBe(false);
    expect(await t.valid([3, 4, 5, 6])).toBe(true);
    expect(await t.valid([3, 4, 5, 10])).toBe(false);
    expect(await t.valid([3, 4, 5, 11])).toBe(false);
  });

  test("string list validation. range", async () => {
    const t = StringListType().range("a", "z");

    expect(await t.valid(["a", "c", "d"])).toBe(true);
    expect(await t.valid(["e", "f", "g", "h"])).toBe(true);
    expect(await t.valid(["e", "f", "g", "h", "z"])).toBe(false);
  });

  class Preferences extends User {}
  class PreferencesSchema implements Schema {
    fields = {
      prefsList: JSONBListType(),
    };
    ent = Preferences;
  }

  class PreferencesJSONSchema implements Schema {
    fields = {
      prefsList: JSONListType(),
    };
    ent = Preferences;
  }

  class PreferencesJSONBAsListSchema implements Schema {
    fields = {
      prefsList: JSONBTypeAsList(),
    };
    ent = Preferences;
  }

  class PreferencesJSONAsListSchema implements Schema {
    fields = {
      prefsList: JSONTypeAsList(),
    };
    ent = Preferences;
  }

  class PreferencesStructAsListSchema implements Schema {
    fields = {
      prefsList: StructTypeAsList({
        tsType: "",
        fields: {
          key1: StringType(),
          key2: IntegerType(),
          key3: BooleanType(),
          key4: IntegerListType(),
        },
      }),
    };
    ent = Preferences;
  }

  class PreferencesStructAsListJSONSchema implements Schema {
    fields = {
      prefsList: StructTypeAsList({
        jsonNotJSONB: true,
        tsType: "",
        fields: {
          key1: StringType(),
          key2: IntegerType(),
          key3: BooleanType(),
          key4: IntegerListType(),
        },
      }),
    };
    ent = Preferences;
  }

  test("jsonb list", async () => {
    const prefsList = [
      {
        key1: "1",
        key2: 2,
        key3: false,
        key4: [1, 2, 3, 4],
      },
      {
        bar: "ff",
        bar2: "gg",
        bar3: null,
      },
    ];
    const action = getInsertAction(
      new PreferencesSchema(),
      new Map<string, any>([["prefsList", prefsList]]),
    );
    await createTables(new PreferencesSchema());

    const ent = await action.saveX();
    expect(convertList(ent.data.prefs_list, convertJSON)).toStrictEqual(
      prefsList,
    );
  });

  test("json list", async () => {
    const prefsList = [
      {
        key1: "1",
        key2: 2,
        key3: false,
        key4: [1, 2, 3, 4],
      },
      {
        bar: "ff",
        bar2: "gg",
        bar3: null,
      },
    ];
    const action = getInsertAction(
      new PreferencesJSONSchema(),
      new Map<string, any>([["prefsList", prefsList]]),
    );
    await createTables(new PreferencesJSONSchema());

    const ent = await action.saveX();
    expect(convertList(ent.data.prefs_list, convertJSON)).toStrictEqual(
      prefsList,
    );
  });

  test("jsonb as list", async () => {
    const prefsList = [
      {
        key1: "1",
        key2: 2,
        key3: false,
        key4: [1, 2, 3, 4],
      },
      {
        bar: "ff",
        bar2: "gg",
        bar3: null,
      },
    ];
    const action = getInsertAction(
      new PreferencesJSONBAsListSchema(),
      new Map<string, any>([["prefsList", prefsList]]),
    );
    await createTables(new PreferencesJSONBAsListSchema());

    const ent = await action.saveX();
    expect(convertJSON(ent.data.prefs_list)).toStrictEqual(prefsList);
  });

  test("json as list", async () => {
    const prefsList = [
      {
        key1: "1",
        key2: 2,
        key3: false,
        key4: [1, 2, 3, 4],
      },
      {
        bar: "ff",
        bar2: "gg",
        bar3: null,
      },
    ];
    const action = getInsertAction(
      new PreferencesJSONAsListSchema(),
      new Map<string, any>([["prefsList", prefsList]]),
    );
    await createTables(new PreferencesJSONAsListSchema());

    const ent = await action.saveX();
    expect(convertJSON(ent.data.prefs_list)).toStrictEqual(prefsList);
  });

  test("struct as list jsonb", async () => {
    const prefsList = [
      {
        key1: "1",
        key2: 2,
        key3: false,
        key4: [1, 2, 3, 4],
      },
      {
        key1: "2",
        key2: 3,
        key3: true,
        key4: [5, 6, 7, 8],
      },
    ];
    const action = getInsertAction(
      new PreferencesStructAsListSchema(),
      new Map<string, any>([["prefsList", prefsList]]),
    );
    await createTables(new PreferencesStructAsListSchema());

    const ent = await action.saveX();
    expect(convertJSON(ent.data.prefs_list)).toStrictEqual(prefsList);
  });

  test("struct as list json", async () => {
    const prefsList = [
      {
        key1: "1",
        key2: 2,
        key3: false,
        key4: [1, 2, 3, 4],
      },
      {
        key1: "2",
        key2: 3,
        key3: true,
        key4: [5, 6, 7, 8],
      },
    ];
    const action = getInsertAction(
      new PreferencesStructAsListJSONSchema(),
      new Map<string, any>([["prefsList", prefsList]]),
    );
    await createTables(new PreferencesStructAsListJSONSchema());

    const ent = await action.saveX();
    expect(convertJSON(ent.data.prefs_list)).toStrictEqual(prefsList);
  });
}
