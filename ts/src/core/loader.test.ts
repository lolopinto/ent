import { ObjectLoader } from "./loader";
import { Pool } from "pg";
import { QueryRecorder } from "../testutils/db_mock";

import { createRowForTest } from "../testutils/write";
import { TestContext } from "../testutils/context/test_context";
import { setLogLevels } from "./logger";
import { MockLogs } from "../testutils/mock_log";
import { buildQuery } from "./ent";
import * as clause from "./clause";
jest.mock("pg");
QueryRecorder.mockPool(Pool);

const ml = new MockLogs();
beforeAll(() => {
  setLogLevels("query");
  ml.mock();
});

afterEach(() => {
  QueryRecorder.clear();
  ml.clear();
});

afterAll(() => {
  ml.restore();
});

const getNewLoader = () => {
  return new ObjectLoader(
    {
      tableName: "users",
      fields: ["id", "first_name"],
    },
    new TestContext(),
  );
};
test("cache hit", async () => {
  await createRowForTest({
    tableName: "users",
    fields: {
      id: 1,
      first_name: "Jon",
    },
  });

  const loader = getNewLoader();

  const row = await loader.load(1);
  expect(row).toStrictEqual({
    id: 1,
    first_name: "Jon",
  });
  const row2 = await loader.load(1);
  expect(row).toBe(row2);
});

test("cache miss", async () => {
  const loader = getNewLoader();

  const expQuery = buildQuery({
    tableName: "users",
    fields: ["id", "first_name"],
    clause: clause.In("id", 1),
  });
  const row = await loader.load(1);

  expect(row).toBe(null);
  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toStrictEqual({
    query: expQuery,
    values: [1],
  });

  const row2 = await loader.load(1);
  expect(row2).toBe(null);
  expect(ml.logs.length).toBe(2);
  expect(ml.logs[1]).toStrictEqual({
    "dataloader-cache-hit": 1,
    "tableName": "users",
  });
});
