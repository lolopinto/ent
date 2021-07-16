import { loadConfig } from "./config";
import DB, { Dialect } from "./db";
import { logEnabled, logIf, setLogLevels } from "./logger";
import { MockLogs } from "../testutils/mock_log";

afterEach(() => {
  delete process.env.DB_CONNECTION_STRING;
});

describe("postgres", () => {
  test("db connection string", () => {
    const connStr = `postgres://:@localhost/ent_test`;
    loadConfig(Buffer.from(`dbConnectionString: ${connStr}`));
    const db = DB.getInstance();
    expect(db.db.config.connectionString).toEqual(connStr);
    expect(db.db.dialect).toBe(Dialect.Postgres);
  });

  test("env variable", () => {
    process.env.DB_CONNECTION_STRING = `postgres://:@localhost/ent_test`;
    const ml = new MockLogs();
    ml.mock();
    loadConfig();
    ml.restore();
    expect(ml.errors.length).toEqual(0);
    const db = DB.getInstance();
    expect(db.db.config.connectionString).toEqual(
      process.env.DB_CONNECTION_STRING,
    );
    expect(db.db.dialect).toBe(Dialect.Postgres);
  });

  test("env variable + db conn string", () => {
    process.env.DB_CONNECTION_STRING = `postgres://ola:@localhost/tsent_test`;
    const connStr = `postgres://:@localhost/ent_test`;
    loadConfig(Buffer.from(`dbConnectionString: ${connStr}`));

    const db = DB.getInstance();
    expect(db.db.config.connectionString).toEqual(
      process.env.DB_CONNECTION_STRING,
    );
    expect(connStr).not.toEqual(process.env.DB_CONNECTION_STRING);
    expect(db.db.dialect).toBe(Dialect.Postgres);
  });

  test("db in config file", () => {
    const data = `
  db:
    database: postgres
    host: localhost  
  `;
    loadConfig(Buffer.from(data));
    const db = DB.getInstance();
    expect(db.db.config).toStrictEqual({
      database: Dialect.Postgres,
      host: "localhost",
    });
    expect(db.db.dialect).toBe(Dialect.Postgres);
  });

  test("db + conn string in config file", () => {
    const connStr = `postgres://:@localhost/ent_test`;

    const data = `
  dbConnectionString: ${connStr}
  db:
    database: postgres
    host: localhost  
  `;
    loadConfig(Buffer.from(data));
    const db = DB.getInstance();
    expect(db.db.config).toStrictEqual({
      connectionString: connStr,
    });
    expect(db.db.dialect).toBe(Dialect.Postgres);
  });

  test("db scoped to env in config file", () => {
    expect(process.env.NODE_ENV).toEqual("test");
    const data = `
  db:
    development:
      database: project_development
      host: localhost
    test:
      database: project_test
      host: localhost
  `;
    loadConfig(Buffer.from(data));
    const db = DB.getInstance();
    expect(db.db.config).toStrictEqual({
      database: "project_test",
      host: "localhost",
    });
    expect(db.db.dialect).toBe(Dialect.Postgres);
  });

  test("logger", () => {
    loadConfig(Buffer.from(`log: info`));

    logIf("error", () => {
      fail("error logQuery not set. shouldn't be called");
    });

    logIf("warn", () => {
      fail("warn logQuery not set. shouldn't be called");
    });

    logIf("query", () => {
      fail("query logQuery not set. shouldn't be called");
    });

    logIf("debug", () => {
      fail("debug logQuery not set. shouldn't be called");
    });

    const ml = new MockLogs();
    ml.mock();

    logIf("info", () => {
      return "hallo";
    });
    ml.restore();
    expect(ml.logs.length).toBe(1);
    expect(ml.logs[0]).toBe("hallo");
  });

  test("config object. log only", () => {
    loadConfig({
      log: "info",
    });
    expect(logEnabled("info")).toBe(true);
    expect(logEnabled("error")).toBe(false);
  });

  test("config object. db", () => {
    loadConfig({
      db: {
        development: {
          database: "project_development",
          host: "localhost",
        },
        test: {
          database: "project_test",
          host: "localhost",
        },
      },
    });
    const db = DB.getInstance();
    expect(db.db.config).toStrictEqual({
      database: "project_test",
      host: "localhost",
    });
    expect(db.db.dialect).toBe(Dialect.Postgres);
  });

  test("config object. db connection string", () => {
    const connStr = `postgres://:@localhost/ent_test`;

    loadConfig({
      dbConnectionString: connStr,
    });
    const db = DB.getInstance();
    expect(db.db.config.connectionString).toEqual(connStr);
    expect(db.db.dialect).toBe(Dialect.Postgres);
  });

  test("env variable + config object", () => {
    process.env.DB_CONNECTION_STRING = `postgres://ola:@localhost/tsent_test`;
    const connStr = `postgres://:@localhost/ent_test`;
    loadConfig({
      dbConnectionString: connStr,
    });

    const db = DB.getInstance();
    expect(db.db.config.connectionString).toEqual(
      process.env.DB_CONNECTION_STRING,
    );
    expect(connStr).not.toEqual(process.env.DB_CONNECTION_STRING);
    expect(db.db.dialect).toBe(Dialect.Postgres);
  });
});

describe("sqlite", () => {
  test("db connection string", () => {
    const connStr = `sqlite:///`;
    loadConfig(Buffer.from(`dbConnectionString: ${connStr}`));
    const db = DB.getInstance();
    expect(db.db.config.connectionString).toEqual(connStr);
    expect(db.db.dialect).toBe(Dialect.SQLite);
  });

  test("env variable", () => {
    process.env.DB_CONNECTION_STRING = `sqlite:///`;
    const ml = new MockLogs();
    ml.mock();
    loadConfig();
    ml.restore();
    expect(ml.errors.length).toEqual(0);
    const db = DB.getInstance();
    expect(db.db.config.connectionString).toEqual(
      process.env.DB_CONNECTION_STRING,
    );
    expect(db.db.dialect).toBe(Dialect.SQLite);
  });

  test("env variable + db conn string", () => {
    process.env.DB_CONNECTION_STRING = `sqlite:///`;
    const connStr = `sqlite:///bar.db`;
    loadConfig(Buffer.from(`dbConnectionString: ${connStr}`));

    const db = DB.getInstance();
    expect(db.db.config.connectionString).toEqual(
      process.env.DB_CONNECTION_STRING,
    );
    expect(connStr).not.toEqual(process.env.DB_CONNECTION_STRING);
    expect(db.db.dialect).toBe(Dialect.SQLite);
  });

  test("config object. log only", () => {
    loadConfig({
      log: "info",
    });
    expect(logEnabled("info")).toBe(true);
    expect(logEnabled("error")).toBe(false);
  });

  test("config object. db connection string", () => {
    const connStr = `sqlite:///foo.db`;

    loadConfig({
      dbConnectionString: connStr,
    });
    const db = DB.getInstance();
    expect(db.db.config.connectionString).toEqual(connStr);
    expect(db.db.dialect).toBe(Dialect.SQLite);
  });

  test("env variable + config object", () => {
    process.env.DB_CONNECTION_STRING = `sqlite:///foo.db`;
    const connStr = `sqlite:///bar.db`;
    loadConfig({
      dbConnectionString: connStr,
    });

    const db = DB.getInstance();
    expect(db.db.config.connectionString).toEqual(
      process.env.DB_CONNECTION_STRING,
    );
    expect(connStr).not.toEqual(process.env.DB_CONNECTION_STRING);
    expect(db.db.dialect).toBe(Dialect.SQLite);
  });
});
