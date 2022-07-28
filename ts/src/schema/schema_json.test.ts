import { LoggedOutViewer } from "../core/viewer";

import { Schema, Field } from ".";
import { User, SimpleAction, BuilderSchema } from "../testutils/builder";
import { TempDB, getSchemaTable } from "../testutils/db/temp_db";
import DB, { Dialect } from "../core/db";
import { Ent } from "../core/base";
import * as fs from "fs";
import { loadConfig } from "../core/config";
import { convertJSON } from "../core/convert";
import { JSONType, JSONBType } from "./json_field";
import { FieldMap } from "./schema";
import { WriteOperation } from "../action";

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
  function validator(val: any) {
    if (typeof val !== "object") {
      return false;
    }
    const requiredKeys = {
      context: true,
    };
    for (const k in val) {
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
}
