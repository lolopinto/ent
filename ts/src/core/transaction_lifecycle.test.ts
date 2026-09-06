import DB, { Client, Dialect } from "./db";
import { withTransaction, getTransactionScope } from "./transaction";
import { getTransactionState } from "./transaction_context";

describe("scoped transaction lifecycle", () => {
  const originalInstance = DB.instance;
  let clients: Client[];
  let queries: string[];
  let behavior: (sql: string) => Promise<any>;
  beforeEach(() => {
    clients = [];
    queries = [];
    behavior = async () => ({ rows: [], rowCount: 0 });
    DB.instance = {
      db: { dialect: Dialect.Postgres },
      async getNewClient() {
        const query = jest.fn(async (sql: string) => {
          queries.push(sql);
          return behavior(sql);
        });
        const client = {
          query,
          queryAll: query,
          exec: query,
          release: jest.fn(),
        };
        clients.push(client);
        return client;
      },
    } as unknown as DB;
  });
  afterEach(() => {
    DB.instance = originalInstance;
  });

  test("BEGIN failure rolls back and releases without invoking callback", async () => {
    const error = new Error("begin failed");
    behavior = async (sql) => {
      if (sql.startsWith("BEGIN")) throw error;
    };
    const callback = jest.fn();
    await expect(withTransaction(callback)).rejects.toBe(error);
    expect(callback).not.toHaveBeenCalled();
    expect(queries).toEqual(["BEGIN ISOLATION LEVEL SERIALIZABLE", "ROLLBACK"]);
    expect(clients[0].release).toHaveBeenCalledTimes(1);
  });

  test("rollback failure preserves original error and discards connection", async () => {
    const error = new Error("callback failed");
    behavior = async (sql) => {
      if (sql === "ROLLBACK") throw new Error("rollback failed");
    };
    await expect(
      withTransaction(async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(clients[0].release).toHaveBeenCalledWith(true);
  });

  test("unknown COMMIT result is never retried or marked committed", async () => {
    const error = new Error("connection closed during COMMIT");
    behavior = async (sql) => {
      if (sql === "COMMIT") throw error;
    };
    const receipt = jest.fn();
    const observer = jest.fn();
    const callback = jest.fn(async () => {
      getTransactionState()!.receipts.push(receipt);
      getTransactionState()!.observers.push(observer);
    });
    await expect(withTransaction(callback, { maxRetries: 3 })).rejects.toBe(
      error,
    );
    expect(callback).toHaveBeenCalledTimes(1);
    expect(receipt).not.toHaveBeenCalled();
    expect(observer).not.toHaveBeenCalled();
  });

  test.each([
    "40001",
    "40P01",
  ])("known PostgreSQL conflict %s reruns with a new scope and bounded attempts", async (code) => {
    const error = Object.assign(new Error("conflict"), { code });
    const scopes: unknown[] = [];
    const callback = jest.fn(async (scope) => {
      expect(scope.attempt).toBe(scopes.length);
      scopes.push(getTransactionState());
      expect(getTransactionScope()?.isolationLevel).toBe("serializable");
      throw error;
    });
    await expect(withTransaction(callback, { maxRetries: 2 })).rejects.toBe(
      error,
    );
    expect(callback).toHaveBeenCalledTimes(3);
    expect(new Set(scopes).size).toBe(3);
    expect(
      clients.every((c) => (c.release as jest.Mock).mock.calls.length === 1),
    ).toBe(true);
  });

  test("receipts precede observers; observer/release failures never retry committed work", async () => {
    const order: string[] = [];
    const callback = jest.fn(async () => {
      getTransactionState()!.receipts.push(() => {
        order.push("receipt");
      });
      getTransactionState()!.observers.push(async () => {
        expect(getTransactionScope()).toBeUndefined();
        order.push("observer");
        throw Object.assign(new Error("observer failure"), { code: "40001" });
      });
      (clients[0].release as jest.Mock).mockRejectedValue(
        new Error("release failure"),
      );
      return 42;
    });
    await expect(withTransaction(callback, { maxRetries: 3 })).resolves.toBe(
      42,
    );
    expect(callback).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["receipt", "observer"]);
    expect(queries).toEqual(["BEGIN ISOLATION LEVEL SERIALIZABLE", "COMMIT"]);
  });

  test("Bun SQL serialization errno and wrapped query errors retain retry information", async () => {
    let calls = 0;
    behavior = async (sql) => {
      if (sql === "SELECT retry" && calls++ === 0) {
        throw { code: "ERR_POSTGRES_SERVER_ERROR", errno: "40001" };
      }
      return { rows: [], rowCount: 0 };
    };
    const callback = jest.fn(async (tx) => {
      await tx.query("SELECT retry").catch(() => {
        throw new Error("wrapped query");
      });
    });
    await withTransaction(callback, { maxRetries: 1 });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test("unawaited in-flight queries finish before rollback and release", async () => {
    let finish!: () => void;
    const waiting = new Promise<void>((r) => {
      finish = r;
    });
    behavior = async (sql) => {
      if (sql === "SELECT slow") await waiting;
      return { rows: [], rowCount: 0 };
    };
    const transaction = withTransaction(async (tx) => {
      void tx.query("SELECT slow");
    });
    await new Promise((r) => setImmediate(r));
    expect(queries).toEqual([
      "BEGIN ISOLATION LEVEL SERIALIZABLE",
      "SELECT slow",
    ]);
    expect(clients[0].release).not.toHaveBeenCalled();
    finish();
    await expect(transaction).rejects.toThrow("await all queries");
    expect(queries[queries.length - 1]).toBe("ROLLBACK");
    expect(clients[0].release).toHaveBeenCalledTimes(1);
  });

  test("unsupported dialects and options reject before acquiring resources", async () => {
    DB.instance.db.dialect = Dialect.SQLite;
    await expect(withTransaction(async () => {})).rejects.toThrow(
      "SQLite is not supported",
    );
    DB.instance.db.dialect = Dialect.Postgres;
    await expect(
      withTransaction(async () => {}, {
        isolationLevel: "repeatable read" as any,
      }),
    ).rejects.toThrow("unsupported");
    await expect(
      withTransaction(async () => {}, { maxRetries: -1 }),
    ).rejects.toThrow("maxRetries");
    expect(clients).toHaveLength(0);
  });
});
