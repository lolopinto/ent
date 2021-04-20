import { loadConfig } from "./config";
import DB from "./db";

afterEach(() => {
  delete process.env.DB_CONNECTION_STRING;
});

test("db connection string", () => {
  const connStr = `postgres://:@localhost/ent_test`;
  loadConfig(Buffer.from(`dbConnectionString: ${connStr}`));
  const db = DB.getInstance();
  expect(db.config.connectionString).toEqual(connStr);
});

test("env variable", () => {
  process.env.DB_CONNECTION_STRING = `postgres://:@localhost/ent_test`;
  loadConfig();
  const db = DB.getInstance();
  expect(db.config.connectionString).toEqual(process.env.DB_CONNECTION_STRING);
});

test("env variable + db conn string", () => {
  process.env.DB_CONNECTION_STRING = `postgres://ola:@localhost/ent_test`;
  const connStr = `postgres://:@localhost/ent_test`;
  loadConfig(Buffer.from(`dbConnectionString: ${connStr}`));

  const db = DB.getInstance();
  expect(db.config.connectionString).toEqual(process.env.DB_CONNECTION_STRING);
  expect(connStr).not.toEqual(process.env.DB_CONNECTION_STRING);
});

test("db in config file", () => {
  const data = `
  db:
    database: postgres
    host: localhost  
  `;
  loadConfig(Buffer.from(data));
  const db = DB.getInstance();
  expect(db.config).toStrictEqual({
    database: "postgres",
    host: "localhost",
  });
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
  expect(db.config).toStrictEqual({
    connectionString: connStr,
  });
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
  expect(db.config).toStrictEqual({
    database: "project_test",
    host: "localhost",
  });
});

// TODO logger next...
// TODO tests...
