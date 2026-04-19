import { DB } from "@snowtop/ent";
import { loadExampleRuntimeConfig } from "../testsetup/example_runtime_config";
import { createDB } from "../testsetup/globalSetup";

async function main() {
  const { db, user, password, client } = await createDB();
  let dbInitialized = false;
  try {
    loadExampleRuntimeConfig({
      runtime: "node",
      postgresDriver: "pg",
      db: {
        database: db,
        host: "localhost",
        user,
        password,
        port: 5432,
        sslmode: "disable",
        max: 200,
      },
    });
    dbInitialized = true;

    const result = await DB.getInstance().getPool().query("SELECT 1 AS ok");
    if (result.rows[0]?.ok !== 1) {
      throw new Error("node runtime smoke test did not return expected row");
    }
  } finally {
    if (dbInitialized) {
      await DB.getInstance().endPool();
    }
    await client.query(`DROP DATABASE ${db}`);
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
