import { Builder } from "./action";
import { ListBasedExecutor } from "./executor";
import { DataOperation } from "./operations";
import { Ent } from "../core/base";
import DB from "../core/db";
import * as logger from "../core/logger";
import { LoggedOutViewer } from "../core/viewer";

afterEach(() => jest.restoreAllMocks());

function setup(sync: boolean) {
  const events: string[] = [];
  const writeError = new Error("write failed");
  const hookError = new Error("rollback hook failed");
  const rollbackError = new Error("rollback failed");
  const releaseError = new Error("release failed");
  const builder = { placeholderID: "cleanup" } as Builder<Ent>;
  const operation = (
    write: () => void,
    rollback: () => void,
  ): DataOperation<Ent> => ({
    builder,
    performWrite: async () => write(),
    performWriteSync: write,
    onRollback: rollback,
  });
  const operations = [
    operation(
      () => events.push("write first"),
      () => {
        events.push("hook first");
        throw hookError;
      },
    ),
    operation(
      () => events.push("write second"),
      () => {
        events.push("hook second");
        throw hookError;
      },
    ),
    operation(
      () => {
        events.push("write last");
        throw writeError;
      },
      () => events.push("hook last"),
    ),
  ];
  const query = jest.fn(async (sql: string) => {
    events.push(sql);
    return { rows: [], rowCount: 0 };
  });
  const release = jest.fn((error?: Error | boolean): void | Promise<void> => {
    events.push("release");
  });
  const client = {
    query,
    queryAll: query,
    exec: query,
    release,
    ...(sync
      ? {
          execSync: () => ({ rows: [], rowCount: 0 }),
          runInTransaction: (write: () => void) => {
            events.push("BEGIN");
            try {
              write();
              events.push("COMMIT");
            } catch (error) {
              events.push("ROLLBACK");
              throw error;
            }
          },
        }
      : {}),
  };
  jest.spyOn(DB, "getInstance").mockReturnValue({
    getNewClient: async () => client,
  } as unknown as DB);
  const log = jest.spyOn(logger, "log").mockImplementation(() => {});
  const executor = new ListBasedExecutor(
    new LoggedOutViewer(),
    builder.placeholderID,
    operations,
  );
  return {
    executor,
    operations,
    events,
    query,
    release,
    log,
    writeError,
    hookError,
    rollbackError,
    releaseError,
  };
}

for (const sync of [false, true]) {
  describe(sync ? "sync client" : "async client", () => {
    test.each([
      "none",
      "throw",
      "reject",
    ])("rollback hook failures preserve cleanup and the write error (release=%s)", async (releaseFailure) => {
      const s = setup(sync);
      if (releaseFailure !== "none") {
        s.query.mockImplementation(async (sql) => {
          s.events.push(sql);
          if (sql === "ROLLBACK") {
            throw s.rollbackError;
          }
          return { rows: [], rowCount: 0 };
        });
        s.release.mockImplementation(() => {
          s.events.push("release");
          if (releaseFailure === "throw") {
            throw s.releaseError;
          }
          return Promise.reject(s.releaseError);
        });
      }

      await expect(s.executor.execute()).rejects.toBe(s.writeError);
      expect(s.events).toEqual([
        "BEGIN",
        "write first",
        "write second",
        "write last",
        ...(sync ? ["ROLLBACK"] : []),
        "hook first",
        "hook second",
        "hook last",
        ...(sync ? [] : ["ROLLBACK"]),
        "release",
      ]);
      expect(s.release).toHaveBeenCalledTimes(1);
      expect(s.release).toHaveBeenCalledWith(s.writeError);
      const secondaryErrors = [s.hookError, s.hookError];
      if (releaseFailure !== "none") {
        if (!sync) {
          secondaryErrors.push(s.rollbackError);
        }
        secondaryErrors.push(s.releaseError);
      }
      expect(s.log.mock.calls.filter(([level]) => level === "error")).toEqual([
        ["error", s.writeError],
        ...secondaryErrors.map((error) => [
          "error",
          expect.objectContaining({ error }),
        ]),
      ]);
    });

    test("postFetch failure preserves the committed result despite release rejection", async () => {
      const s = setup(sync);
      s.operations.pop();
      const postFetchError = new Error("postFetch failed");
      s.operations[0].postFetch = async () => {
        throw postFetchError;
      };
      s.release.mockRejectedValue(s.releaseError);
      await expect(s.executor.execute()).rejects.toBe(postFetchError);
      expect(s.events).toEqual([
        "BEGIN",
        "write first",
        "write second",
        "COMMIT",
      ]);
      expect(s.release).toHaveBeenCalledTimes(1);
      expect(s.release).toHaveBeenCalledWith(postFetchError);
      expect(s.log).toHaveBeenCalledWith(
        "error",
        expect.objectContaining({ error: s.releaseError }),
      );
    });

    test.each([
      "throw",
      "reject",
    ])("release failure after commit is awaited without a second release (%s)", async (failure) => {
      const s = setup(sync);
      s.operations.pop();
      s.release.mockImplementation(() => {
        if (failure === "throw") {
          throw s.releaseError;
        }
        return Promise.reject(s.releaseError);
      });
      await expect(s.executor.execute()).rejects.toBe(s.releaseError);
      expect(s.events).toEqual([
        "BEGIN",
        "write first",
        "write second",
        "COMMIT",
      ]);
      expect(s.release).toHaveBeenCalledTimes(1);
      expect(s.release).toHaveBeenCalledWith();
    });

    test("a logging failure cannot replace the original write error", async () => {
      const s = setup(sync);
      s.log.mockImplementation((level) => {
        if (level === "error") {
          throw new Error("logger failed");
        }
      });
      await expect(s.executor.execute()).rejects.toBe(s.writeError);
      expect(s.events).toContain("hook last");
      expect(s.events).toContain("ROLLBACK");
      expect(s.release).toHaveBeenCalledTimes(1);
    });
  });
}

test("a failed BEGIN releases the client without rollback or invalidation", async () => {
  const s = setup(false);
  const beginError = new Error("BEGIN failed");
  s.query.mockRejectedValue(beginError);
  s.release.mockRejectedValue(s.releaseError);
  await expect(s.executor.execute()).rejects.toBe(beginError);
  expect(s.query.mock.calls).toEqual([["BEGIN"]]);
  expect(s.events).toEqual([]);
  expect(s.release).toHaveBeenCalledTimes(1);
  expect(s.release).toHaveBeenCalledWith(beginError);
});

test("rollback query logging cannot prevent database cleanup", async () => {
  const s = setup(false);
  s.log.mockImplementation((level, value) => {
    if (level === "query" && value.query === "ROLLBACK") {
      throw new Error("query logger failed");
    }
  });
  await expect(s.executor.execute()).rejects.toBe(s.writeError);
  expect(s.query.mock.calls).toEqual([["BEGIN"], ["ROLLBACK"]]);
  expect(s.events).toContain("hook last");
  expect(s.release).toHaveBeenCalledTimes(1);
});
