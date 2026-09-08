// transaction_runtime.test.ts runs this regression test in a child process so
// Node with pg, Bun with pg, and native Bun SQL cannot share singleton state.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");
const {
  DB,
  loadEntX,
  ObjectLoaderFactory,
  AlwaysAllowPrivacyPolicy,
  ContextCache,
  LoggedOutViewer,
} = require("../index");
const { withTransaction, getTransactionScope } = require("../action");
assert.equal("withTransaction" in require("../index"), false);
assert.equal("getTransactionScope" in require("../index"), false);

async function main() {
  const admin = new Client({
    host: "localhost",
    database: "postgres",
    user: process.env.POSTGRES_USER || undefined,
    password: process.env.POSTGRES_PASSWORD || undefined,
  });
  const database = `ent_scope_${randomUUID().replaceAll("-", "")}`;
  await admin.connect();
  await admin.query(`CREATE DATABASE ${database}`);
  try {
    delete process.env.DB_CONNECTION_STRING;
    DB.initDB({
      db: {
        host: "localhost",
        database,
        user: process.env.POSTGRES_USER || undefined,
        password: process.env.POSTGRES_PASSWORD || undefined,
      },
      runtime: process.versions.bun ? "bun" : "node",
      postgresDriver: process.argv[2] || "pg",
    });
    await DB.getInstance()
      .getPool()
      .query(
        "CREATE TABLE scope_accounts (id text PRIMARY KEY, balance integer NOT NULL)",
      );
    await DB.getInstance()
      .getPool()
      .query("INSERT INTO scope_accounts VALUES ('a',100)");
    class Account {
      nodeType = "Account";
      constructor(viewer, row) {
        this.viewer = viewer;
        this.id = row.id;
        this.balance = row.balance;
      }
      getPrivacyPolicy() {
        return AlwaysAllowPrivacyPolicy;
      }
      __setRawDBData() {}
    }
    const context = {
      cache: new ContextCache(),
      getViewer() {
        return viewer;
      },
    };
    const viewer = new LoggedOutViewer(context);
    const options = {
      tableName: "scope_accounts",
      fields: ["id", "balance"],
      ent: Account,
      loaderFactory: new ObjectLoaderFactory({
        tableName: "scope_accounts",
        fields: ["id", "balance"],
        key: "id",
        keyType: "text",
      }),
    };
    const load = () => loadEntX(viewer, "a", options);
    let meet;
    const ready = new Promise((r) => {
      meet = r;
    });
    let arrivals = 0;
    const attempts = [];
    const sell = (amount) =>
      withTransaction(
        async (tx) => {
          attempts.push(tx.attempt);
          assert.equal(getTransactionScope().isolationLevel, "serializable");
          const account = await load();
          if (tx.attempt === 0) {
            if (++arrivals === 2) {
              meet();
            }
            await ready;
          }
          await tx.query(
            "UPDATE scope_accounts SET balance = $1 WHERE id = $2",
            [account.balance - amount, "a"],
          );
          assert.equal((await load()).balance, account.balance - amount);
        },
        { maxRetries: 3 },
      );
    await Promise.all([sell(20), sell(30)]);
    assert.equal((await load()).balance, 50);
    assert.ok(attempts.includes(1));
    await assert.rejects(
      withTransaction(async (tx) => {
        await tx.exec("UPDATE scope_accounts SET balance = 0");
        throw new Error("abort");
      }),
      /abort/,
    );
    assert.equal((await load()).balance, 50);
    await withTransaction(async (tx) => {
      await tx.exec(
        "UPDATE scope_accounts SET balance = 40; UPDATE scope_accounts SET balance = 30",
      );
      assert.equal((await load()).balance, 30);
    });
    await assert.rejects(
      withTransaction(async (tx) => {
        await tx.exec(
          "UPDATE scope_accounts SET balance = 20; UPDATE scope_accounts SET balance = 10",
        );
        throw new Error("abort multiple commands");
      }),
      /abort multiple commands/,
    );
    assert.equal((await load()).balance, 30);
    assert.equal(getTransactionScope(), undefined);
    console.log(
      `transaction runtime passed: ${process.versions.bun ? "bun" : "node"}/${process.argv[2] || "pg"}`,
    );
  } finally {
    if (DB.instance) {
      await DB.getInstance().endPool();
    }
    await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);
    await admin.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
