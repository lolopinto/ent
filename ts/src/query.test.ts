import * as query from "./query";

test("Eq", () => {
  const clause = query.Eq("id", 4);
  expect(clause.clause(1)).toBe("id = $1");
  expect(clause.clause(2)).toBe("id = $2");
  expect(clause.values()).toStrictEqual([4]);
});

test("And", () => {
  const clause = query.And(query.Eq("id1", "iddd"), query.Eq("id2", "foo"));
  expect(clause.clause(1)).toBe("id1 = $1 AND id2 = $2");
  expect(clause.values()).toStrictEqual(["iddd", "foo"]);
});

test("Or", () => {
  const clause = query.Or(query.Eq("id1", "iddd"), query.Eq("id2", "foo"));
  expect(clause.clause(1)).toBe("id1 = $1 OR id2 = $2");
  expect(clause.values()).toStrictEqual(["iddd", "foo"]);
});

describe("In", () => {
  test("spread args", () => {
    const clause = query.In("id", 1, 2, 3);
    expect(clause.clause(1)).toBe("id IN ($1)");
    expect(clause.values()).toStrictEqual([1, 2, 3]);
  });

  test("list", () => {
    const clause = query.In("id", ...[1, 2, 3]);
    expect(clause.clause(1)).toBe("id IN ($1)");
    expect(clause.values()).toStrictEqual([1, 2, 3]);
  });
});
