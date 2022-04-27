require("ts-node/register");
import { Client as PGClient } from "pg";

async function teardown() {
  const db = process.env.POSTGRES_TEST_DB;
  if (!db) {
    return;
  }

  //@ts-ignore
  const client: PGClient = global.__GLOBAL_CLIENT__;

  // TODO would be ideal to be able to disable this from a test but doesn't seem like there's a way to pass
  // info from test to here
  await client.query(`DROP DATABASE ${db}`);
  await client.end();
}

export default teardown;
