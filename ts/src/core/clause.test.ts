import * as clause from "./clause";

test("Eq", () => {
  const cls = clause.Eq("id", 4);
  expect(cls.clause(1)).toBe("id = $1");
  expect(cls.clause(2)).toBe("id = $2");
  expect(cls.values()).toStrictEqual([4]);
  expect(cls.instanceKey()).toEqual("id=4");
});

test("Greater", () => {
  const cls = clause.Greater("id", 4);
  expect(cls.clause(1)).toBe("id > $1");
  expect(cls.clause(2)).toBe("id > $2");
  expect(cls.values()).toStrictEqual([4]);
  expect(cls.instanceKey()).toEqual("id>4");
});

test("Less", () => {
  const cls = clause.Less("id", 4);
  expect(cls.clause(1)).toBe("id < $1");
  expect(cls.clause(2)).toBe("id < $2");
  expect(cls.values()).toStrictEqual([4]);
  expect(cls.instanceKey()).toEqual("id<4");
});

test("GreaterEq", () => {
  const cls = clause.GreaterEq("id", 4);
  expect(cls.clause(1)).toBe("id >= $1");
  expect(cls.clause(2)).toBe("id >= $2");
  expect(cls.values()).toStrictEqual([4]);
  expect(cls.instanceKey()).toEqual("id>=4");
});

test("LessEq", () => {
  const cls = clause.LessEq("id", 4);
  expect(cls.clause(1)).toBe("id <= $1");
  expect(cls.clause(2)).toBe("id <= $2");
  expect(cls.values()).toStrictEqual([4]);
  expect(cls.instanceKey()).toEqual("id<=4");
});

test("And", () => {
  const cls = clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo"));
  expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2");
  expect(cls.values()).toStrictEqual(["iddd", "foo"]);
  expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo");
});

test("Or", () => {
  const cls = clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo"));
  expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2");
  expect(cls.values()).toStrictEqual(["iddd", "foo"]);
  expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo");
});

describe("In", () => {
  test("spread args", () => {
    const cls = clause.In("id", 1, 2, 3);
    expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
    expect(cls.values()).toStrictEqual([1, 2, 3]);
    expect(cls.instanceKey()).toEqual("in:id:1,2,3");
  });

  test("list", () => {
    const cls = clause.In("id", ...[1, 2, 3]);
    expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
    expect(cls.values()).toStrictEqual([1, 2, 3]);
    expect(cls.instanceKey()).toEqual("in:id:1,2,3");
  });
});
