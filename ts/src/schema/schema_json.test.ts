import { LoggedOutViewer } from "../core/viewer.js";

import { IntegerType, Schema, StructType } from "./index.js";
import { User, SimpleAction, BuilderSchema } from "../testutils/builder.js";
import { TempDB, getSchemaTable } from "../testutils/db/temp_db.js";
import DB, { Dialect } from "../core/db.js";
import { Ent } from "../core/base.js";
import { loadConfig } from "../core/config.js";
import { convertJSON } from "../core/convert.js";
import { JSONType, JSONBType } from "./json_field.js";
import { FieldMap } from "./schema.js";
import { WriteOperation } from "../action/index.js";

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
  setupTempDB(Dialect.SQLite, `sqlite:///schema_json.db`);
  commonTests();
});

function commonTests() {
  function validator(val: any) {
    if (typeof val !== "object") {
      return false;
    }
    const requiredKeys = {
      context: true,
    };
    for (const _ in val) {
      if (val === undefined) {
        return false;
      }
    }
    for (const k in requiredKeys) {
      if (!val[k]) {
        return false;
      }
    }
    return true;
  }
  class Notification extends User {}
  class NotificationSchema implements Schema {
    fields: FieldMap = {
      col: JSONType({
        validator,
      }),
    };
    ent = Notification;
  }

  class NotificationJSONBSchema implements Schema {
    fields: FieldMap = {
      col: JSONBType({
        validator,
      }),
    };
    ent = Notification;
  }

  test("json", async () => {
    const action = getInsertAction(
      new NotificationSchema(),
      new Map<string, any>([
        [
          "col",
          {
            key: "val",
            type: "2",
            context: {
              sss: 2,
            },
          },
        ],
      ]),
    );
    await createTables(new NotificationSchema());

    const ent = await action.saveX();
    expect(ent).toBeInstanceOf(Notification);
    expect(convertJSON(ent.data.col)["context"]).toBeDefined();
  });

  test("json. invalid", async () => {
    const action = getInsertAction(
      new NotificationSchema(),
      new Map<string, any>([
        [
          "col",
          {
            key: "val",
            type: "2",
          },
        ],
      ]),
    );
    await createTables(new NotificationSchema());

    try {
      await action.saveX();
      throw new Error("should throw");
    } catch (err) {
      expect(err.message).toMatch(/invalid field col/);
    }
  });

  test("jsonb", async () => {
    const action = getInsertAction(
      new NotificationJSONBSchema(),
      new Map<string, any>([
        [
          "col",
          {
            key: "val",
            type: "2",
            context: {
              sss: 2,
            },
          },
        ],
      ]),
    );
    await createTables(new NotificationJSONBSchema());

    const ent = await action.saveX();
    expect(ent).toBeInstanceOf(Notification);
    expect(convertJSON(ent.data.col)["context"]).toBeDefined();
  });

  test("jsonb. invalid", async () => {
    const action = getInsertAction(
      new NotificationJSONBSchema(),
      new Map<string, any>([
        [
          "col",
          {
            key: "val",
            type: "2",
          },
        ],
      ]),
    );
    await createTables(new NotificationJSONBSchema());

    try {
      await action.saveX();
      throw new Error("should throw");
    } catch (err) {
      expect(err.message).toMatch(/invalid field col/);
    }
  });

  test("jsonb nested in struct", async () => {
    class UserPrefs extends User {}
    class UserPrefsSchema implements Schema {
      fields: FieldMap = {
        struct: StructType({
          fields: {
            jsonb: JSONBType(),
            int: IntegerType(),
          },
          tsType: "UserPrefs",
        }),
      };

      ent = UserPrefs;
    }

    const action = getInsertAction(
      new UserPrefsSchema(),
      new Map<string, any>([
        [
          "struct",
          {
            jsonb: {
              key: "val",
              type: "2",
            },
            int: 2,
          },
        ],
      ]),
    );
    await createTables(new UserPrefsSchema());

    const ent = await action.saveX();
    expect(convertJSON(ent.data.struct)).toStrictEqual({
      jsonb: {
        key: "val",
        type: "2",
      },
      int: 2,
    });
  });
}
