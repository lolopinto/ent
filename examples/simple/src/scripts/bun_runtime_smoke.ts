import { DB } from "@snowtop/ent";
import {
  convertIntEnumUsedInListList,
  convertUserPreferredShiftList,
  IntEnumUsedInList,
  UserPreferredShift,
} from "../ent/generated/types";
import { loadExampleRuntimeConfig } from "../runtime_config";
import { createDB } from "../testsetup/db_setup";

async function main() {
  const { db, user, password, client } = await createDB();
  let dbInitialized = false;
  try {
    loadExampleRuntimeConfig({
      runtime: "bun",
      postgresDriver: "bun",
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
      throw new Error("bun runtime smoke test did not return expected row");
    }

    const pool = DB.getInstance().getPool();
    await pool.exec(
      "CREATE TEMP TABLE bun_runtime_smoke_arrays (txt text[], ids uuid[])",
    );
    await pool.exec(
      "INSERT INTO bun_runtime_smoke_arrays(txt, ids) VALUES ($1, $2)",
      [["a", '"quoted"', null], ["00000000-0000-0000-0000-000000000001"]],
    );
    const arrayResult = await pool.query(
      "SELECT txt, $1::uuid[] @> ARRAY[$2::uuid] AS has_id FROM bun_runtime_smoke_arrays",
      [
        ["00000000-0000-0000-0000-000000000001"],
        "00000000-0000-0000-0000-000000000001",
      ],
    );
    const txt = arrayResult.rows[0]?.txt;
    if (
      !Array.isArray(txt) ||
      txt[1] !== '"quoted"' ||
      arrayResult.rows[0]?.has_id !== true
    ) {
      throw new Error("bun runtime smoke test did not preserve array values");
    }

    const shifts = convertUserPreferredShiftList("{morning,evening}" as any);
    if (
      shifts[0] !== UserPreferredShift.Morning ||
      shifts[1] !== UserPreferredShift.Evening
    ) {
      throw new Error("bun runtime smoke test did not parse enum array values");
    }

    const intEnums = convertIntEnumUsedInListList("{2,3}" as any);
    if (
      intEnums[0] !== IntEnumUsedInList.No ||
      intEnums[1] !== IntEnumUsedInList.Maybe
    ) {
      throw new Error(
        "bun runtime smoke test did not parse numeric enum array values",
      );
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
