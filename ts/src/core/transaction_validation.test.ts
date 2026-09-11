import { assertValidationQuery } from "./transaction_validation";

test.each([
  "SELECT * FROM accounts WHERE id = $1",
  "WITH rows AS (SELECT 1 AS n) SELECT n FROM rows; -- trailing comment",
  "SELECT 'COMMIT; UPDATE accounts', \"update\" FROM accounts",
  "SELECT $$COMMIT;$$, $tag$DELETE FROM accounts;$tag$",
  "/* outer /* nested */ comment */ SELECT 1",
  "VALUES (1), (2)",
])("accepts a single validation read: %s", (sql) => {
  expect(() => assertValidationQuery(sql)).not.toThrow();
});

test.each([
  "SELECT 1; COMMIT; SELECT 2",
  "SELECT 1 -- comment\r; COMMIT",
  "SELECT foo$tag$ FROM accounts; COMMIT; SELECT foo$tag$ FROM accounts",
  String.raw`SELECT '\' -- '; COMMIT; --`,
  "SELECT 1 /* comment */; ROLLBACK",
  "WITH changed AS (UPDATE accounts SET amount = 1 RETURNING *) SELECT * FROM changed",
  "WITH changed AS (DELETE FROM accounts RETURNING *) SELECT * FROM changed",
  "SELECT * FROM accounts FOR KEY SHARE",
  "SELECT 1 INTO another_table",
  "SELECT 'unfinished",
  "SELECT $$unfinished",
  "SELECT 1 /* unfinished",
  "SET TRANSACTION READ WRITE",
])("rejects writes, transaction control, and malformed validation SQL: %s", (sql) => {
  expect(() => assertValidationQuery(sql)).toThrow("single read query");
});
