import * as clause from "./clause";
import { loadConfig } from "./config";

describe("postgres", () => {
  beforeAll(() => {
    // specify dialect as postgres
    const connStr = `postgres://:@localhost/ent_test`;
    loadConfig(Buffer.from(`dbConnectionString: ${connStr}`));
  });

  describe("Eq", () => {
    test("normal", () => {
      const cls = clause.Eq("id", 4);
      expect(cls.clause(1)).toBe("id = $1");
      expect(cls.clause(2)).toBe("id = $2");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id=4");
    });

    test("sensitive value", () => {
      const cls = clause.Eq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id = $1");
      expect(cls.clause(2)).toBe("id = $2");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id=4");
    });
  });

  describe("NotEq", () => {
    test("normal", () => {
      const cls = clause.NotEq("id", 4);
      expect(cls.clause(1)).toBe("id != $1");
      expect(cls.clause(2)).toBe("id != $2");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id!=4");
    });

    test("sensitive value", () => {
      const cls = clause.NotEq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id != $1");
      expect(cls.clause(2)).toBe("id != $2");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id!=4");
    });
  });

  describe("Greater", () => {
    test("normal", () => {
      const cls = clause.Greater("id", 4);
      expect(cls.clause(1)).toBe("id > $1");
      expect(cls.clause(2)).toBe("id > $2");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id>4");
    });

    test("sensitive value", () => {
      const cls = clause.Greater("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id > $1");
      expect(cls.clause(2)).toBe("id > $2");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id>4");
    });
  });

  describe("Less", () => {
    test("normal", () => {
      const cls = clause.Less("id", 4);
      expect(cls.clause(1)).toBe("id < $1");
      expect(cls.clause(2)).toBe("id < $2");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id<4");
    });

    test("sensitive value", () => {
      const cls = clause.Less("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id < $1");
      expect(cls.clause(2)).toBe("id < $2");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id<4");
    });
  });

  describe("GreaterEq", () => {
    test("normal", () => {
      const cls = clause.GreaterEq("id", 4);
      expect(cls.clause(1)).toBe("id >= $1");
      expect(cls.clause(2)).toBe("id >= $2");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id>=4");
    });

    test("sensitive value", () => {
      const cls = clause.GreaterEq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id >= $1");
      expect(cls.clause(2)).toBe("id >= $2");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id>=4");
    });
  });

  describe("LessEq", () => {
    test("normal", () => {
      const cls = clause.LessEq("id", 4);
      expect(cls.clause(1)).toBe("id <= $1");
      expect(cls.clause(2)).toBe("id <= $2");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id<=4");
    });

    test("sensitive value", () => {
      const cls = clause.LessEq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id <= $1");
      expect(cls.clause(2)).toBe("id <= $2");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id<=4");
    });
  });

  describe("And", () => {
    test("2 items", () => {
      const cls = clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo"));
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2");
      expect(cls.values()).toStrictEqual(["iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo");
    });

    test("3 items", () => {
      const cls = clause.And(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", "foo"),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2 AND id3 = $3");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("3 items. one sensitive value", () => {
      const cls = clause.And(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", clause.sensitiveValue("foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2 AND id3 = $3");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "***", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("composite And with And first", () => {
      const cls = clause.And(
        clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2 AND id3 = $3");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("composite And with And after", () => {
      const cls = clause.And(
        clause.Eq("id1", "iddd"),
        clause.And(clause.Eq("id2", "foo"), clause.Eq("id3", "baz")),
      );
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2 AND id3 = $3");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("composite And with sensitive value in there", () => {
      const cls = clause.And(
        clause.Eq("id1", "iddd"),
        clause.And(
          clause.Eq("id2", "foo"),
          clause.Eq("id3", clause.sensitiveValue("baz")),
        ),
      );
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2 AND id3 = $3");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "***"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });
  });

  describe("Or", () => {
    test("2 items", () => {
      const cls = clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo"));
      expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2");
      expect(cls.values()).toStrictEqual(["iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo");
    });

    test("3 items", () => {
      const cls = clause.Or(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", "foo"),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2 OR id3 = $3");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("3 items. one sensitive value", () => {
      const cls = clause.Or(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", clause.sensitiveValue("foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2 OR id3 = $3");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "***", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("composite Or with Or first", () => {
      const cls = clause.Or(
        clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2 OR id3 = $3");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("composite Or with Or after", () => {
      const cls = clause.Or(
        clause.Eq("id1", "iddd"),
        clause.Or(clause.Eq("id2", "foo"), clause.Eq("id3", "baz")),
      );
      expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2 OR id3 = $3");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("composite or with sensitive value in there", () => {
      const cls = clause.Or(
        clause.Eq("id1", "iddd"),
        clause.Or(
          clause.Eq("id2", "foo"),
          clause.Eq("id3", clause.sensitiveValue("baz")),
        ),
      );
      expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2 OR id3 = $3");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "***"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });
  });

  // TODO: AND OR mixed together?

  describe("In", () => {
    test("spread args", () => {
      const cls = clause.In("id", 1, 2, 3);
      expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("spread args with sensitive value", () => {
      const cls = clause.In("id", 1, 2, clause.sensitiveValue(3));
      expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, "*"]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("list", () => {
      const cls = clause.In("id", ...[1, 2, 3]);
      expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("list with sensitive value", () => {
      const cls = clause.In("id", ...[1, clause.sensitiveValue(2), 3]);
      expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, "*", 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });
  });
});

describe("sqlite", () => {
  beforeAll(() => {
    // specify dialect as sqlite
    const connStr = `sqlite:///`;
    loadConfig(Buffer.from(`dbConnectionString: ${connStr}`));
  });

  describe("Eq", () => {
    test("normal", () => {
      const cls = clause.Eq("id", 4);
      expect(cls.clause(1)).toBe("id = ?");
      expect(cls.clause(2)).toBe("id = ?");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id=4");
    });

    test("sensitive value", () => {
      const cls = clause.Eq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id = ?");
      expect(cls.clause(2)).toBe("id = ?");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id=4");
    });
  });

  describe("Greater", () => {
    test("normal", () => {
      const cls = clause.Greater("id", 4);
      expect(cls.clause(1)).toBe("id > ?");
      expect(cls.clause(2)).toBe("id > ?");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id>4");
    });

    test("sensitive value", () => {
      const cls = clause.Greater("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id > ?");
      expect(cls.clause(2)).toBe("id > ?");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id>4");
    });
  });

  describe("Less", () => {
    test("normal", () => {
      const cls = clause.Less("id", 4);
      expect(cls.clause(1)).toBe("id < ?");
      expect(cls.clause(2)).toBe("id < ?");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id<4");
    });

    test("sensitive value", () => {
      const cls = clause.Less("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id < ?");
      expect(cls.clause(2)).toBe("id < ?");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id<4");
    });
  });

  describe("GreaterEq", () => {
    test("normal", () => {
      const cls = clause.GreaterEq("id", 4);
      expect(cls.clause(1)).toBe("id >= ?");
      expect(cls.clause(2)).toBe("id >= ?");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id>=4");
    });

    test("sensitive value", () => {
      const cls = clause.GreaterEq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id >= ?");
      expect(cls.clause(2)).toBe("id >= ?");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id>=4");
    });
  });

  describe("LessEq", () => {
    test("normal", () => {
      const cls = clause.LessEq("id", 4);
      expect(cls.clause(1)).toBe("id <= ?");
      expect(cls.clause(2)).toBe("id <= ?");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id<=4");
    });

    test("sensitive value", () => {
      const cls = clause.LessEq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id <= ?");
      expect(cls.clause(2)).toBe("id <= ?");
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id<=4");
    });
  });

  describe("And", () => {
    test("2 items", () => {
      const cls = clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo"));
      expect(cls.clause(1)).toBe("id1 = ? AND id2 = ?");
      expect(cls.values()).toStrictEqual(["iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo");
    });

    test("3 items", () => {
      const cls = clause.And(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", "foo"),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = ? AND id2 = ? AND id3 = ?");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("3 items. one sensitive value", () => {
      const cls = clause.And(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", clause.sensitiveValue("foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = ? AND id2 = ? AND id3 = ?");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "***", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("composite And with And first", () => {
      const cls = clause.And(
        clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = ? AND id2 = ? AND id3 = ?");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("composite And with And after", () => {
      const cls = clause.And(
        clause.Eq("id1", "iddd"),
        clause.And(clause.Eq("id2", "foo"), clause.Eq("id3", "baz")),
      );
      expect(cls.clause(1)).toBe("id1 = ? AND id2 = ? AND id3 = ?");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("composite And with sensitive value in there", () => {
      const cls = clause.And(
        clause.Eq("id1", "iddd"),
        clause.And(
          clause.Eq("id2", "foo"),
          clause.Eq("id3", clause.sensitiveValue("baz")),
        ),
      );
      expect(cls.clause(1)).toBe("id1 = ? AND id2 = ? AND id3 = ?");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "***"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });
  });

  describe("Or", () => {
    test("2 items", () => {
      const cls = clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo"));
      expect(cls.clause(1)).toBe("id1 = ? OR id2 = ?");
      expect(cls.values()).toStrictEqual(["iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo");
    });

    test("3 items", () => {
      const cls = clause.Or(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", "foo"),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = ? OR id2 = ? OR id3 = ?");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("3 items. one sensitive value", () => {
      const cls = clause.Or(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", clause.sensitiveValue("foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = ? OR id2 = ? OR id3 = ?");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "***", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("composite Or with Or first", () => {
      const cls = clause.Or(
        clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = ? OR id2 = ? OR id3 = ?");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("composite Or with Or after", () => {
      const cls = clause.Or(
        clause.Eq("id1", "iddd"),
        clause.Or(clause.Eq("id2", "foo"), clause.Eq("id3", "baz")),
      );
      expect(cls.clause(1)).toBe("id1 = ? OR id2 = ? OR id3 = ?");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("composite or with sensitive value in there", () => {
      const cls = clause.Or(
        clause.Eq("id1", "iddd"),
        clause.Or(
          clause.Eq("id2", "foo"),
          clause.Eq("id3", clause.sensitiveValue("baz")),
        ),
      );
      expect(cls.clause(1)).toBe("id1 = ? OR id2 = ? OR id3 = ?");
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "***"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });
  });

  // TODO: AND OR mixed together?

  describe("In", () => {
    test("spread args", () => {
      const cls = clause.In("id", 1, 2, 3);
      expect(cls.clause(1)).toBe("id IN (?, ?, ?)");
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("spread args with sensitive value", () => {
      const cls = clause.In("id", 1, 2, clause.sensitiveValue(3));
      expect(cls.clause(1)).toBe("id IN (?, ?, ?)");
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, "*"]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("list", () => {
      const cls = clause.In("id", ...[1, 2, 3]);
      expect(cls.clause(1)).toBe("id IN (?, ?, ?)");
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("list with sensitive value", () => {
      const cls = clause.In("id", ...[1, clause.sensitiveValue(2), 3]);
      expect(cls.clause(1)).toBe("id IN (?, ?, ?)");
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, "*", 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });
  });
});
