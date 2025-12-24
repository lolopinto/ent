import { NumberOps } from "../action/relative_value.js";
import { Eq, Clause } from "./clause.js";
import { buildUpdateQuery } from "./ent.js";

// for now, simplifying tests and assuming all postgres
test("simple update", () => {
  const [q, values] = buildUpdateQuery({
    tableName: "users",
    fields: {
      first_name: "Jon",
      balance: 100,
    },
    whereClause: Eq("id", 1),
  });
  expect(q).toBe(
    `UPDATE users SET first_name = $1, balance = $2 WHERE id = $3`,
  );
  expect(values).toStrictEqual(["Jon", 100, 1]);
});

describe("with expression", () => {
  test("add", () => {
    const [q, values] = buildUpdateQuery({
      tableName: "users",
      fields: {
        first_name: "Jon",
        balance: 5,
      },
      whereClause: Eq("id", 1),
      expressions: new Map<string, Clause>([
        ["balance", NumberOps.addNumber(50).sqlExpression("balance")],
      ]),
    });
    expect(q).toBe(
      `UPDATE users SET first_name = $1, balance = balance + $2 WHERE id = $3`,
    );
    expect(values).toStrictEqual(["Jon", 50, 1]);
  });

  test("divide", () => {
    const [q, values] = buildUpdateQuery({
      tableName: "users",
      fields: {
        first_name: "Jon",
        balance: 5,
      },
      whereClause: Eq("id", 1),
      expressions: new Map<string, Clause>([
        ["balance", NumberOps.divideNumber(50).sqlExpression("balance")],
      ]),
    });
    expect(q).toBe(
      `UPDATE users SET first_name = $1, balance = balance / $2 WHERE id = $3`,
    );
    expect(values).toStrictEqual(["Jon", 50, 1]);
  });

  test("subtract", () => {
    const [q, values] = buildUpdateQuery({
      tableName: "users",
      fields: {
        first_name: "Jon",
        balance: 5,
      },
      whereClause: Eq("id", 1),
      expressions: new Map<string, Clause>([
        ["balance", NumberOps.subtractNumber(50).sqlExpression("balance")],
      ]),
    });
    expect(q).toBe(
      `UPDATE users SET first_name = $1, balance = balance - $2 WHERE id = $3`,
    );
    expect(values).toStrictEqual(["Jon", 50, 1]);
  });

  test("multiply", () => {
    const [q, values] = buildUpdateQuery({
      tableName: "users",
      fields: {
        first_name: "Jon",
        balance: 5,
      },
      whereClause: Eq("id", 1),
      expressions: new Map<string, Clause>([
        ["balance", NumberOps.multiplyNumber(50).sqlExpression("balance")],
      ]),
    });
    expect(q).toBe(
      `UPDATE users SET first_name = $1, balance = balance * $2 WHERE id = $3`,
    );
    expect(values).toStrictEqual(["Jon", 50, 1]);
  });

  test("modulo", () => {
    const [q, values] = buildUpdateQuery({
      tableName: "users",
      fields: {
        first_name: "Jon",
        balance: 5,
      },
      whereClause: Eq("id", 1),
      expressions: new Map<string, Clause>([
        ["balance", NumberOps.moduloNumber(50).sqlExpression("balance")],
      ]),
    });
    expect(q).toBe(
      `UPDATE users SET first_name = $1, balance = balance % $2 WHERE id = $3`,
    );
    expect(values).toStrictEqual(["Jon", 50, 1]);
  });

  // for now it skips. TODO should probably throw since it means something broke somewhere?
  // the generated APIs shouldn't make this possible...
  test("without field and with expression", () => {
    const [q, values] = buildUpdateQuery({
      tableName: "users",
      fields: {
        first_name: "Jon",
        // balance: 5,
      },
      whereClause: Eq("id", 1),
      expressions: new Map<string, Clause>([
        ["balance", NumberOps.addNumber(50).sqlExpression("balance")],
      ]),
    });
    expect(q).toBe(`UPDATE users SET first_name = $1 WHERE id = $2`);
    expect(values).toStrictEqual(["Jon", 1]);
  });
});
