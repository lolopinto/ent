import { randomBytes } from "crypto";
import { Client as PGClient } from "pg";
import type DB from "../../core/db";
import type { Client } from "../../core/db";

const cleanupTimeoutMs = 1000;

async function boundedCleanup(operation: () => Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Test database connection cleanup timed out")),
          cleanupTimeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export class TestDatabaseCleanupError extends Error {
  constructor(public readonly errors: unknown[]) {
    super(`Test database cleanup failed: ${errors.map(String).join("; ")}`);
  }
}

/** Owns exactly one successfully created database, never an existing name. */
export class PostgresTestDatabase {
  readonly user = process.env.POSTGRES_USER || "";
  readonly password = process.env.POSTGRES_PASSWORD || "";
  readonly connection = {
    host: "localhost",
    port: 5432,
    user: this.user,
    password: this.password,
  };
  private readonly admin = new PGClient({
    ...this.connection,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    options: "-c lock_timeout=2000",
  });
  private oid?: string;
  private started = false;
  private cleanupPromise?: Promise<void>;
  private cleanups: (() => Promise<unknown>)[] = [];
  private pools = new Set<DB>();

  constructor(readonly name = `ent_test_${randomBytes(12).toString("hex")}`) {
    // PostgreSQL truncates identifiers beyond 63 bytes. Never claim ownership
    // of a truncated name or interpolate an unquoted caller-supplied name.
    if (!name || name.includes("\0") || Buffer.byteLength(name) > 63) {
      throw new Error("Invalid test database name");
    }
  }

  private identifier() {
    return `"${this.name.replace(/"/g, '""')}"`;
  }

  async create() {
    if (this.started || this.cleanupPromise) {
      throw new Error("Test database setup can only run once");
    }
    this.started = true;
    try {
      await this.admin.connect();
      await this.admin.query(`CREATE DATABASE ${this.identifier()}`);
      const result = await this.admin.query(
        "SELECT oid::text FROM pg_database WHERE datname = $1",
        [this.name],
      );
      this.oid = result.rows[0]?.oid;
      if (!this.oid) {
        throw new Error("Created test database disappeared during setup");
      }
    } catch (error) {
      await this.cleanupAfterFailure(error);
    }
  }

  trackClient(client: PGClient) {
    if (
      !this.oid ||
      this.cleanupPromise ||
      client.database !== this.name ||
      client.host !== this.connection.host ||
      client.port !== this.connection.port
    ) {
      throw new Error("Cannot track a connection outside this test database");
    }
    this.cleanups.push(() => client.end());
  }

  /** Also supports pools configured by tests after TempDB.beforeAll(false). */
  trackRuntimeDB(db: DB | undefined) {
    if (
      !db ||
      !this.oid ||
      this.cleanupPromise ||
      db.db.dialect !== "postgres" ||
      this.pools.has(db)
    ) {
      return;
    }
    const config = db.db.config;
    const url = config.connectionString
      ? new URL(config.connectionString)
      : undefined;
    const name = url
      ? decodeURIComponent(url.pathname.slice(1))
      : config.database;
    const host = url ? url.hostname : config.host;
    const port = Number((url ? url.port : config.port) || 5432);
    if (
      name !== this.name ||
      host !== this.connection.host ||
      port !== this.connection.port ||
      // A URL query can override pg's actual destination. Fail closed instead
      // of treating a similarly named database on another server as ours.
      (url &&
        ["host", "hostaddr", "port", "database", "dbname"].some((key) =>
          url.searchParams.has(key),
        ))
    ) {
      return;
    }
    this.pools.add(db);
    const connection = db.getConnection();
    const originalNewClient = connection.newClient;
    const borrowed = new Set<Client>();
    let closing = false;
    let cancelPending: () => void;
    const closed = new Promise<never>((_, reject) => {
      cancelPending = () => reject(new Error("Test database is closing"));
    });
    // There may be no outstanding acquisitions when cleanup starts.
    closed.catch(() => {});
    // Destroy outstanding leases before ending the pool. Otherwise pool.end()
    // waits forever, and terminating their backends can emit unhandled errors.
    const acquire = async () => {
      if (closing) {
        throw new Error("Test database is closing");
      }
      const client = await originalNewClient.call(connection);
      if (closing) {
        await client.release(true);
        throw new Error("Test database is closing");
      }
      borrowed.add(client);
      const release = client.release.bind(client);
      client.release = async (error?: Error | boolean) => {
        if (borrowed.delete(client) || !closing) {
          await release(error);
        }
      };
      return client;
    };
    const newClient = () => Promise.race([acquire(), closed]);
    connection.newClient = newClient;
    this.cleanups.push(async () => {
      closing = true;
      cancelPending();
      const results = await Promise.allSettled(
        [...borrowed].map((client) => client.release(true)),
      );
      try {
        await db.endPool();
      } finally {
        if (connection.newClient === newClient) {
          connection.newClient = originalNewClient;
        }
      }
      const errors = results.flatMap((r) =>
        r.status === "rejected" ? [r.reason] : [],
      );
      if (errors.length) {
        throw new TestDatabaseCleanupError(errors);
      }
    });
  }

  async cleanupAfterFailure(error: unknown): Promise<never> {
    try {
      await this.close();
    } catch (cleanupError) {
      // Preserve the setup error and its stack while retaining cleanup evidence.
      if (error instanceof Error) {
        Object.assign(error, { cleanupError });
      }
    }
    throw error;
  }

  close(): Promise<void> {
    this.cleanupPromise ??= this.cleanup();
    return this.cleanupPromise;
  }

  private async cleanup() {
    const errors: unknown[] = [];
    try {
      // Check before closing pools too: a replaced database may have acquired
      // new sessions through a pool with the same connection configuration.
      await this.verifyIdentity();
      const results = await Promise.allSettled(
        this.cleanups.map((cleanup) => boundedCleanup(cleanup)),
      );
      for (const result of results) {
        if (result.status === "rejected") {
          errors.push(result.reason);
        }
      }
      if (this.oid) {
        if (await this.verifyIdentity()) {
          // FORCE is confined to the database this instance successfully created.
          await this.admin.query(
            `DROP DATABASE ${this.identifier()} WITH (FORCE)`,
          );
        }
        this.oid = undefined;
      }
    } catch (error) {
      errors.push(error);
    } finally {
      try {
        await boundedCleanup(() => this.admin.end());
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) {
      throw new TestDatabaseCleanupError(errors);
    }
  }

  private async verifyIdentity() {
    if (!this.oid) {
      return false;
    }
    const result = await this.admin.query(
      "SELECT oid::text FROM pg_database WHERE datname = $1",
      [this.name],
    );
    if (result.rows.length && result.rows[0].oid !== this.oid) {
      throw new Error(`Refusing to drop replaced test database ${this.name}`);
    }
    return result.rows.length !== 0;
  }
}
