import { v1 } from "uuid";
import * as clause from "./clause";
import { loadConfig } from "./config";

interface ExampleData {
  id: string;
  bar: string;
  ids: string;
}

interface EdgeData {
  id1: string;
  id2: string;
  id3: string;
  id4: string;
  id5: string;
  id6: string;
  id7: string;
  id8: string;
}

interface JSONData {
  jsonb: string[];
}

interface FullTextData {
  name_idx: string;
}

interface EventData {
  id: string;
  start_time: Date;
}

interface BalanceData {
  balance: number;
}

describe("postgres", () => {
  beforeAll(() => {
    // specify dialect as postgres
    const connStr = `postgres://:@localhost/ent_test`;
    loadConfig(Buffer.from(`dbConnectionString: ${connStr}`));
  });

  describe("Eq", () => {
    test("normal", () => {
      const cls = clause.Eq<ExampleData>("id", 4);
      expect(cls.clause(1)).toBe("id = $1");
      expect(cls.clause(2)).toBe("id = $2");
      expect(cls.clause(1, "t")).toBe("t.id = $1");
      expect(cls.clause(2, "t")).toBe("t.id = $2");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id=4");
    });

    test("sensitive value", () => {
      const cls = clause.Eq<ExampleData>("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id = $1");
      expect(cls.clause(2)).toBe("id = $2");
      expect(cls.clause(1, "t")).toBe("t.id = $1");
      expect(cls.clause(2, "t")).toBe("t.id = $2");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id=4");
    });
  });

  describe("NotEq", () => {
    test("normal", () => {
      const cls = clause.NotEq<ExampleData>("id", 4);
      expect(cls.clause(1)).toBe("id != $1");
      expect(cls.clause(2)).toBe("id != $2");
      expect(cls.clause(1, "t")).toBe("t.id != $1");
      expect(cls.clause(2, "t")).toBe("t.id != $2");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id!=4");
    });

    test("sensitive value", () => {
      const cls = clause.NotEq<ExampleData>("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id != $1");
      expect(cls.clause(2)).toBe("id != $2");
      expect(cls.clause(1, "t")).toBe("t.id != $1");
      expect(cls.clause(2, "t")).toBe("t.id != $2");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id!=4");
    });
  });

  describe("Greater", () => {
    test("normal", () => {
      const cls = clause.Greater<ExampleData>("id", 4);
      expect(cls.clause(1)).toBe("id > $1");
      expect(cls.clause(2)).toBe("id > $2");
      expect(cls.clause(1, "t")).toBe("t.id > $1");
      expect(cls.clause(2, "t")).toBe("t.id > $2");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id>4");
    });

    test("sensitive value", () => {
      const cls = clause.Greater<ExampleData>("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id > $1");
      expect(cls.clause(2)).toBe("id > $2");
      expect(cls.clause(1, "t")).toBe("t.id > $1");
      expect(cls.clause(2, "t")).toBe("t.id > $2");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id>4");
    });
  });

  describe("Less", () => {
    test("normal", () => {
      const cls = clause.Less<ExampleData>("id", 4);
      expect(cls.clause(1)).toBe("id < $1");
      expect(cls.clause(2)).toBe("id < $2");
      expect(cls.clause(1, "t")).toBe("t.id < $1");
      expect(cls.clause(2, "t")).toBe("t.id < $2");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id<4");
    });

    test("sensitive value", () => {
      const cls = clause.Less<ExampleData>("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id < $1");
      expect(cls.clause(2)).toBe("id < $2");
      expect(cls.clause(1, "t")).toBe("t.id < $1");
      expect(cls.clause(2, "t")).toBe("t.id < $2");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id<4");
    });
  });

  describe("GreaterEq", () => {
    test("normal", () => {
      const cls = clause.GreaterEq<ExampleData>("id", 4);
      expect(cls.clause(1)).toBe("id >= $1");
      expect(cls.clause(2)).toBe("id >= $2");
      expect(cls.clause(1, "t")).toBe("t.id >= $1");
      expect(cls.clause(2, "t")).toBe("t.id >= $2");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id>=4");
    });

    test("sensitive value", () => {
      const cls = clause.GreaterEq<ExampleData>("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id >= $1");
      expect(cls.clause(2)).toBe("id >= $2");
      expect(cls.clause(1, "t")).toBe("t.id >= $1");
      expect(cls.clause(2, "t")).toBe("t.id >= $2");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id>=4");
    });
  });

  describe("LessEq", () => {
    test("normal", () => {
      const cls = clause.LessEq<ExampleData>("id", 4);
      expect(cls.clause(1)).toBe("id <= $1");
      expect(cls.clause(2)).toBe("id <= $2");
      expect(cls.clause(1, "t")).toBe("t.id <= $1");
      expect(cls.clause(2, "t")).toBe("t.id <= $2");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id<=4");
    });

    test("sensitive value", () => {
      const cls = clause.LessEq<ExampleData>("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id <= $1");
      expect(cls.clause(2)).toBe("id <= $2");
      expect(cls.clause(1, "t")).toBe("t.id <= $1");
      expect(cls.clause(2, "t")).toBe("t.id <= $2");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id<=4");
    });
  });

  describe("And", () => {
    test("2 items", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", "foo"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2");
      expect(cls.clause(1, "t")).toBe("t.id1 = $1 AND t.id2 = $2");
      expect(cls.columns()).toStrictEqual(["id1", "id2"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo");
    });

    test("3 items", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", "foo"),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2 AND id3 = $3");
      expect(cls.clause(1, "t")).toBe(
        "t.id1 = $1 AND t.id2 = $2 AND t.id3 = $3",
      );
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("3 items. one sensitive value", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", clause.sensitiveValue("foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2 AND id3 = $3");
      expect(cls.clause(1, "t")).toBe(
        "t.id1 = $1 AND t.id2 = $2 AND t.id3 = $3",
      );
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "***", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("composite And with And first", () => {
      const cls = clause.And<EdgeData>(
        clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2 AND id3 = $3");
      expect(cls.clause(1, "t")).toBe(
        "t.id1 = $1 AND t.id2 = $2 AND t.id3 = $3",
      );
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("composite And with And after", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.And(clause.Eq("id2", "foo"), clause.Eq("id3", "baz")),
      );
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2 AND id3 = $3");
      expect(cls.clause(1, "t")).toBe(
        "t.id1 = $1 AND t.id2 = $2 AND t.id3 = $3",
      );
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("composite And with sensitive value in there", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.And(
          clause.Eq("id2", "foo"),
          clause.Eq("id3", clause.sensitiveValue("baz")),
        ),
      );
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2 AND id3 = $3");
      expect(cls.clause(1, "t")).toBe(
        "t.id1 = $1 AND t.id2 = $2 AND t.id3 = $3",
      );
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "***"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });
  });

  describe("Or", () => {
    test("2 items", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", "foo"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2");
      expect(cls.clause(1, "t")).toBe("t.id1 = $1 OR t.id2 = $2");
      expect(cls.columns()).toStrictEqual(["id1", "id2"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo");
    });

    test("3 items", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", "foo"),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2 OR id3 = $3");
      expect(cls.clause(1, "t")).toBe("t.id1 = $1 OR t.id2 = $2 OR t.id3 = $3");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("3 items. one sensitive value", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", clause.sensitiveValue("foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2 OR id3 = $3");
      expect(cls.clause(1, "t")).toBe("t.id1 = $1 OR t.id2 = $2 OR t.id3 = $3");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "***", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("composite Or with Or first", () => {
      const cls = clause.Or<EdgeData>(
        clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2 OR id3 = $3");
      expect(cls.clause(1, "t")).toBe("t.id1 = $1 OR t.id2 = $2 OR t.id3 = $3");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("composite Or with Or after", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Or(clause.Eq("id2", "foo"), clause.Eq("id3", "baz")),
      );
      expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2 OR id3 = $3");
      expect(cls.clause(1, "t")).toBe("t.id1 = $1 OR t.id2 = $2 OR t.id3 = $3");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("composite or with sensitive value in there", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Or(
          clause.Eq("id2", "foo"),
          clause.Eq("id3", clause.sensitiveValue("baz")),
        ),
      );
      expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2 OR id3 = $3");
      expect(cls.clause(1, "t")).toBe("t.id1 = $1 OR t.id2 = $2 OR t.id3 = $3");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "***"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });
  });

  describe("nested and/or", () => {
    test("OR nested in AND", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id3", "bar"),
        clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
      );
      expect(cls.clause(1)).toBe("id3 = $1 AND (id1 = $2 OR id2 = $3)");
      expect(cls.clause(1, "t")).toBe(
        "t.id3 = $1 AND (t.id1 = $2 OR t.id2 = $3)",
      );
      expect(cls.columns()).toStrictEqual(["id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id3=bar AND (id1=iddd OR id2=foo)");
    });

    test("AND nested in Or", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id3", "bar"),
        clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
      );
      expect(cls.clause(1)).toBe("id3 = $1 OR (id1 = $2 AND id2 = $3)");
      expect(cls.clause(1, "t")).toBe(
        "t.id3 = $1 OR (t.id1 = $2 AND t.id2 = $3)",
      );
      expect(cls.columns()).toStrictEqual(["id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id3=bar OR (id1=iddd AND id2=foo)");
    });

    test("Or nested in AND nested in OR", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id4", "baz"),
        clause.And(
          clause.Eq("id3", "bar"),
          clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        ),
      );
      expect(cls.clause(1)).toBe(
        "id4 = $1 OR (id3 = $2 AND (id1 = $3 OR id2 = $4))",
      );
      expect(cls.clause(1, "t")).toBe(
        "t.id4 = $1 OR (t.id3 = $2 AND (t.id1 = $3 OR t.id2 = $4))",
      );
      expect(cls.columns()).toStrictEqual(["id4", "id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toBe(
        "id4=baz OR (id3=bar AND (id1=iddd OR id2=foo))",
      );
    });

    test("And nested in OR nested in AND", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id4", "baz"),
        clause.Or(
          clause.Eq("id3", "bar"),
          clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        ),
      );
      expect(cls.clause(1)).toBe(
        "id4 = $1 AND (id3 = $2 OR (id1 = $3 AND id2 = $4))",
      );
      expect(cls.clause(1, "t")).toBe(
        "t.id4 = $1 AND (t.id3 = $2 OR (t.id1 = $3 AND t.id2 = $4))",
      );
      expect(cls.columns()).toStrictEqual(["id4", "id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toBe(
        "id4=baz AND (id3=bar OR (id1=iddd AND id2=foo))",
      );
    });

    test("complexx", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id4", "baz"),
        clause.Or(
          clause.Eq("id3", "bar"),
          clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
          clause.Or(clause.Eq("id5", "whaa"), clause.Eq("id6", "indeed")),
        ),
      );
      expect(cls.clause(1)).toBe(
        "id4 = $1 AND (id3 = $2 OR (id1 = $3 AND id2 = $4) OR id5 = $5 OR id6 = $6)",
        // could also do this...
        //         "id4 = ? AND (id3 = ? OR (id1 = ? AND id2 = ?) OR (id5 = ? OR id6 = ?))",
      );
      expect(cls.clause(1, "t")).toBe(
        "t.id4 = $1 AND (t.id3 = $2 OR (t.id1 = $3 AND t.id2 = $4) OR t.id5 = $5 OR t.id6 = $6)",
        // could also do this...
        //         "id4 = ? AND (id3 = ? OR (id1 = ? AND id2 = ?) OR (id5 = ? OR id6 = ?))",
      );
      expect(cls.columns()).toStrictEqual([
        "id4",
        "id3",
        "id1",
        "id2",
        "id5",
        "id6",
      ]);
      expect(cls.values()).toStrictEqual([
        "baz",
        "bar",
        "iddd",
        "foo",
        "whaa",
        "indeed",
      ]);
      expect(cls.logValues()).toStrictEqual([
        "baz",
        "bar",
        "iddd",
        "foo",
        "whaa",
        "indeed",
      ]);
      expect(cls.instanceKey()).toBe(
        "id4=baz AND (id3=bar OR (id1=iddd AND id2=foo) OR id5=whaa OR id6=indeed)",
      );
    });
  });

  describe("null on null", () => {
    test("OR nested in AND", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id3", null),
        clause.Or(clause.Eq("id1", null), clause.Eq("id2", "foo")),
      );
      expect(cls.clause(1)).toBe("id3 IS NULL AND (id1 IS NULL OR id2 = $1)");
      expect(cls.clause(1, "t")).toBe(
        "t.id3 IS NULL AND (t.id1 IS NULL OR t.id2 = $1)",
      );
      expect(cls.columns()).toStrictEqual(["id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["foo"]);
      expect(cls.logValues()).toStrictEqual(["foo"]);
      expect(cls.instanceKey()).toEqual(
        "id3 IS NULL AND (id1 IS NULL OR id2=foo)",
      );
    });

    test("AND nested in OR", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id3", null),
        clause.And(clause.Eq("id1", null), clause.Eq("id2", "foo")),
      );
      expect(cls.clause(1)).toBe("id3 IS NULL OR (id1 IS NULL AND id2 = $1)");
      expect(cls.clause(1, "t")).toBe(
        "t.id3 IS NULL OR (t.id1 IS NULL AND t.id2 = $1)",
      );
      expect(cls.columns()).toStrictEqual(["id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["foo"]);
      expect(cls.logValues()).toStrictEqual(["foo"]);
      expect(cls.instanceKey()).toEqual(
        "id3 IS NULL OR (id1 IS NULL AND id2=foo)",
      );
    });

    test("Or nested in AND nested in OR", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id4", "baz"),
        clause.And(
          clause.Eq("id3", null),
          clause.Or(clause.Eq("id1", null), clause.Eq("id2", "foo")),
        ),
      );
      expect(cls.clause(1)).toBe(
        "id4 = $1 OR (id3 IS NULL AND (id1 IS NULL OR id2 = $2))",
      );
      expect(cls.clause(1, "t")).toBe(
        "t.id4 = $1 OR (t.id3 IS NULL AND (t.id1 IS NULL OR t.id2 = $2))",
      );
      expect(cls.columns()).toStrictEqual(["id4", "id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["baz", "foo"]);
      expect(cls.logValues()).toStrictEqual(["baz", "foo"]);
      expect(cls.instanceKey()).toBe(
        "id4=baz OR (id3 IS NULL AND (id1 IS NULL OR id2=foo))",
      );
    });

    test("complexx ", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id4", "baz"),
        clause.Or(
          clause.Eq("id3", null),
          clause.And(clause.Eq("id1", null), clause.Eq("id2", "foo")),
          clause.Or(
            clause.Eq("id5", "whaa"),
            clause.Eq("id6", "indeed"),
            clause.Eq("id7", null),
          ),
          clause.Eq("id8", "wheee"),
        ),
      );
      expect(cls.clause(1)).toBe(
        "id4 = $1 AND (id3 IS NULL OR (id1 IS NULL AND id2 = $2) OR id5 = $3 OR id6 = $4 OR id7 IS NULL OR id8 = $5)",
      );
      expect(cls.clause(1, "t")).toBe(
        "t.id4 = $1 AND (t.id3 IS NULL OR (t.id1 IS NULL AND t.id2 = $2) OR t.id5 = $3 OR t.id6 = $4 OR t.id7 IS NULL OR t.id8 = $5)",
      );
      expect(cls.columns()).toStrictEqual([
        "id4",
        "id3",
        "id1",
        "id2",
        "id5",
        "id6",
        "id7",
        "id8",
      ]);
      expect(cls.values()).toStrictEqual([
        "baz",
        "foo",
        "whaa",
        "indeed",
        "wheee",
      ]);
      expect(cls.logValues()).toStrictEqual([
        "baz",
        "foo",
        "whaa",
        "indeed",
        "wheee",
      ]);
      expect(cls.instanceKey()).toBe(
        "id4=baz AND (id3 IS NULL OR (id1 IS NULL AND id2=foo) OR id5=whaa OR id6=indeed OR id7 IS NULL OR id8=wheee)",
      );
    });
  });

  describe("In|NotIn", () => {
    test("1 arg", () => {
      const cls = clause.In<ExampleData>("id", 1);
      expect(cls.clause(1)).toBe("id = $1");
      expect(cls.clause(1, "t")).toBe("t.id = $1");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1]);
      expect(cls.logValues()).toStrictEqual([1]);
      expect(cls.instanceKey()).toEqual("in:id:1");
    });

    test("not in. 1 arg", () => {
      const cls = clause.DBTypeNotIn<ExampleData>("id", [1], "integer");
      expect(cls.clause(1)).toBe("id != $1");
      expect(cls.clause(1, "t")).toBe("t.id != $1");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1]);
      expect(cls.logValues()).toStrictEqual([1]);
      expect(cls.instanceKey()).toEqual("not in:id:1");
    });

    test("spread args", () => {
      const cls = clause.In<ExampleData>("id", 1, 2, 3);
      expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
      expect(cls.clause(1, "t")).toBe("t.id IN ($1, $2, $3)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("spread args with sensitive value", () => {
      const cls = clause.In<ExampleData>("id", 1, 2, clause.sensitiveValue(3));
      expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
      expect(cls.clause(1, "t")).toBe("t.id IN ($1, $2, $3)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, "*"]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("list", () => {
      const cls = clause.In<ExampleData>("id", ...[1, 2, 3]);
      expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
      expect(cls.clause(1, "t")).toBe("t.id IN ($1, $2, $3)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("list with sensitive value", () => {
      const cls = clause.In<ExampleData>(
        "id",
        ...[1, clause.sensitiveValue(2), 3],
      );
      expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
      expect(cls.clause(1, "t")).toBe("t.id IN ($1, $2, $3)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, "*", 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    describe("valuesList threshold", () => {
      const spy = jest
        .spyOn(clause.inClause, "getPostgresInClauseValuesThreshold")
        .mockImplementation(() => 5);

      afterAll(() => {
        spy.mockRestore();
      });

      test("uuid implicit", () => {
        const ids = [1, 2, 3, 4, 5].map((_) => v1());

        const cls = clause.In<ExampleData>("id", ids);
        expect(cls.clause(1)).toBe(
          "id IN (VALUES($1::uuid), ($2), ($3), ($4), ($5))",
        );
        expect(cls.clause(1, "t")).toBe(
          "t.id IN (VALUES($1::uuid), ($2), ($3), ($4), ($5))",
        );
        expect(cls.columns()).toStrictEqual(["id"]);
        expect(cls.values()).toStrictEqual(ids);
        expect(cls.logValues()).toStrictEqual(ids);
        expect(cls.instanceKey()).toEqual(`in:id:${ids.join(",")}`);
      });

      test("integer", () => {
        const ids = [1, 2, 3, 4, 5];

        const cls = clause.IntegerIn<ExampleData>("id", ids);
        expect(cls.clause(1)).toBe(
          "id IN (VALUES($1::integer), ($2), ($3), ($4), ($5))",
        );
        expect(cls.clause(1, "t")).toBe(
          "t.id IN (VALUES($1::integer), ($2), ($3), ($4), ($5))",
        );
        expect(cls.columns()).toStrictEqual(["id"]);
        expect(cls.values()).toStrictEqual(ids);
        expect(cls.logValues()).toStrictEqual(ids);
        expect(cls.instanceKey()).toEqual(`in:id:${ids.join(",")}`);
      });

      test("uuid explicit", () => {
        const ids = [1, 2, 3, 4, 5].map((_) => v1());

        const cls = clause.UuidIn<ExampleData>("id", ids);
        expect(cls.clause(1)).toBe(
          "id IN (VALUES($1::uuid), ($2), ($3), ($4), ($5))",
        );
        expect(cls.clause(1, "t")).toBe(
          "t.id IN (VALUES($1::uuid), ($2), ($3), ($4), ($5))",
        );
        expect(cls.columns()).toStrictEqual(["id"]);
        expect(cls.values()).toStrictEqual(ids);
        expect(cls.logValues()).toStrictEqual(ids);
        expect(cls.instanceKey()).toEqual(`in:id:${ids.join(",")}`);
      });

      test("not in uuid", () => {
        const ids = [1, 2, 3, 4, 5].map((_) => v1());

        const cls = clause.UuidNotIn<ExampleData>("id", ids);
        expect(cls.clause(1)).toBe(
          "id NOT IN (VALUES($1::uuid), ($2), ($3), ($4), ($5))",
        );
        expect(cls.clause(1, "t")).toBe(
          "t.id NOT IN (VALUES($1::uuid), ($2), ($3), ($4), ($5))",
        );
        expect(cls.columns()).toStrictEqual(["id"]);
        expect(cls.values()).toStrictEqual(ids);
        expect(cls.logValues()).toStrictEqual(ids);
        expect(cls.instanceKey()).toEqual(`not in:id:${ids.join(",")}`);
      });

      test("not in text", () => {
        const ids = [1, 2, 3, 4, 5].map((_) => `id-${_}`);

        const cls = clause.DBTypeNotIn<ExampleData>("id", ids, "text");
        expect(cls.clause(1)).toBe(
          "id NOT IN (VALUES($1::text), ($2), ($3), ($4), ($5))",
        );
        expect(cls.clause(1, "t")).toBe(
          "t.id NOT IN (VALUES($1::text), ($2), ($3), ($4), ($5))",
        );
        expect(cls.columns()).toStrictEqual(["id"]);
        expect(cls.values()).toStrictEqual(ids);
        expect(cls.logValues()).toStrictEqual(ids);
        expect(cls.instanceKey()).toEqual(`not in:id:${ids.join(",")}`);
      });
    });
  });

  describe("array", () => {
    test("eq", () => {
      const cls = clause.ArrayEq<ExampleData>("ids", 3);
      expect(cls.clause(1)).toBe("$1 = ANY(ids)");
      expect(cls.clause(1, "t")).toBe("$1 = ANY(t.ids)");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([3]);
      expect(cls.logValues()).toStrictEqual([3]);
      expect(cls.instanceKey()).toEqual("ids=3");
    });

    test("ne", () => {
      const cls = clause.ArrayNotEq<ExampleData>("ids", 3);
      expect(cls.clause(1)).toBe("$1 != ANY(ids)");
      expect(cls.clause(1, "t")).toBe("$1 != ANY(t.ids)");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([3]);
      expect(cls.logValues()).toStrictEqual([3]);
      expect(cls.instanceKey()).toEqual("ids!=3");
    });

    test("contains val", () => {
      const cls = clause.PostgresArrayContainsValue<ExampleData>("ids", 3);
      expect(cls.clause(1)).toBe("ids @> $1");
      expect(cls.clause(1, "t")).toBe("t.ids @> $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{3}`]);
      expect(cls.logValues()).toStrictEqual([`{3}`]);
      expect(cls.instanceKey()).toEqual("ids@>3");
    });

    test("contains val:string", () => {
      const cls = clause.PostgresArrayContainsValue<ExampleData>("ids", "foo");
      expect(cls.clause(1)).toBe("ids @> $1");
      expect(cls.clause(1, "t")).toBe("t.ids @> $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{foo}`]);
      expect(cls.logValues()).toStrictEqual([`{foo}`]);
      expect(cls.instanceKey()).toEqual("ids@>foo");
    });

    test("contains list", () => {
      const cls = clause.PostgresArrayContains<ExampleData>("ids", [3, 4]);
      expect(cls.clause(1)).toBe("ids @> $1");
      expect(cls.clause(1, "t")).toBe("t.ids @> $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{3, 4}`]);
      expect(cls.logValues()).toStrictEqual([`{3, 4}`]);
      expect(cls.instanceKey()).toEqual("ids@>3,4");
    });

    test("contains list string", () => {
      const cls = clause.PostgresArrayContains<ExampleData>("ids", [
        "foo",
        "bar",
      ]);
      expect(cls.clause(1)).toBe("ids @> $1");
      expect(cls.clause(1, "t")).toBe("t.ids @> $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{foo, bar}`]);
      expect(cls.logValues()).toStrictEqual([`{foo, bar}`]);
      expect(cls.instanceKey()).toEqual("ids@>foo,bar");
    });

    test("not contains val", () => {
      const cls = clause.PostgresArrayNotContainsValue<ExampleData>("ids", 3);
      expect(cls.clause(1)).toBe("NOT ids @> $1");
      expect(cls.clause(1, "t")).toBe("NOT t.ids @> $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{3}`]);
      expect(cls.logValues()).toStrictEqual([`{3}`]);
      expect(cls.instanceKey()).toEqual("NOT:ids@>3");
    });

    test("not contains list", () => {
      const cls = clause.PostgresArrayNotContains<ExampleData>("ids", [3, 4]);
      expect(cls.clause(1)).toBe("NOT ids @> $1");
      expect(cls.clause(1, "t")).toBe("NOT t.ids @> $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{3, 4}`]);
      expect(cls.logValues()).toStrictEqual([`{3, 4}`]);
      expect(cls.instanceKey()).toEqual("NOT:ids@>3,4");
    });

    test("overlaps", () => {
      const cls = clause.PostgresArrayOverlaps<ExampleData>("ids", [3, 4]);
      expect(cls.clause(1)).toBe("ids && $1");
      expect(cls.clause(1, "t")).toBe("t.ids && $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{3, 4}`]);
      expect(cls.logValues()).toStrictEqual([`{3, 4}`]);
      expect(cls.instanceKey()).toEqual("ids&&3,4");
    });

    test("not overlaps", () => {
      const cls = clause.PostgresArrayNotOverlaps<ExampleData>("ids", [3, 4]);
      expect(cls.clause(1)).toBe("NOT ids && $1");
      expect(cls.clause(1, "t")).toBe("NOT t.ids && $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{3, 4}`]);
      expect(cls.logValues()).toStrictEqual([`{3, 4}`]);
      expect(cls.instanceKey()).toEqual("NOT:ids&&3,4");
    });
  });

  describe("jsonb", () => {
    test("eq", () => {
      const cls = clause.JSONPathValuePredicate<JSONData>(
        "jsonb",
        "$.*",
        3,
        "==",
      );
      expect(cls.clause(1)).toBe("jsonb @@ $1");
      expect(cls.clause(1, "t")).toBe("t.jsonb @@ $1");
      expect(cls.columns()).toStrictEqual(["jsonb"]);
      expect(cls.values()).toStrictEqual(["$.* == 3"]);
      expect(cls.logValues()).toStrictEqual(["$.* == 3"]);
      expect(cls.instanceKey()).toEqual("jsonb$.*3==");
    });

    test("eq string", () => {
      const cls = clause.JSONPathValuePredicate<JSONData>(
        "jsonb",
        "$.*",
        "hello",
        "==",
      );
      expect(cls.clause(1)).toBe("jsonb @@ $1");
      expect(cls.clause(1, "t")).toBe("t.jsonb @@ $1");
      expect(cls.columns()).toStrictEqual(["jsonb"]);
      expect(cls.values()).toStrictEqual(['$.* == "hello"']);
      expect(cls.logValues()).toStrictEqual(['$.* == "hello"']);
      expect(cls.instanceKey()).toEqual("jsonb$.*hello==");
    });

    test("ge", () => {
      const cls = clause.JSONPathValuePredicate<JSONData>(
        "jsonb",
        "$.*",
        3,
        ">",
      );
      expect(cls.clause(1)).toBe("jsonb @@ $1");
      expect(cls.clause(1, "t")).toBe("t.jsonb @@ $1");
      expect(cls.columns()).toStrictEqual(["jsonb"]);
      expect(cls.values()).toStrictEqual(["$.* > 3"]);
      expect(cls.logValues()).toStrictEqual(["$.* > 3"]);
      expect(cls.instanceKey()).toEqual("jsonb$.*3>");
    });

    test("ne", () => {
      const cls = clause.JSONPathValuePredicate<JSONData>(
        "jsonb",
        "$.*",
        3,
        "!=",
      );
      expect(cls.clause(1)).toBe("jsonb @@ $1");
      expect(cls.clause(1, "t")).toBe("t.jsonb @@ $1");
      expect(cls.columns()).toStrictEqual(["jsonb"]);
      expect(cls.values()).toStrictEqual(["$.* != 3"]);
      expect(cls.logValues()).toStrictEqual(["$.* != 3"]);
      expect(cls.instanceKey()).toEqual("jsonb$.*3!=");
    });

    test("specific path", () => {
      const cls = clause.JSONPathValuePredicate<JSONData>(
        "jsonb",
        "$.col",
        3,
        "!=",
      );
      expect(cls.clause(1)).toBe("jsonb @@ $1");
      expect(cls.clause(1, "t")).toBe("t.jsonb @@ $1");
      expect(cls.columns()).toStrictEqual(["jsonb"]);
      expect(cls.values()).toStrictEqual(["$.col != 3"]);
      expect(cls.logValues()).toStrictEqual(["$.col != 3"]);
      expect(cls.instanceKey()).toEqual("jsonb$.col3!=");
    });

    test("specific path arr idx", () => {
      const cls = clause.JSONPathValuePredicate<JSONData>(
        "jsonb",
        "$.col[*]",
        3,
        "!=",
      );
      expect(cls.clause(1)).toBe("jsonb @@ $1");
      expect(cls.clause(1, "t")).toBe("t.jsonb @@ $1");
      expect(cls.columns()).toStrictEqual(["jsonb"]);
      expect(cls.values()).toStrictEqual(["$.col[*] != 3"]);
      expect(cls.logValues()).toStrictEqual(["$.col[*] != 3"]);
      expect(cls.instanceKey()).toEqual("jsonb$.col[*]3!=");
    });
  });

  describe("full text", () => {
    test("tsquery string", () => {
      const cls = clause.TsQuery<FullTextData>("name_idx", "value");
      expect(cls.clause(1)).toBe("name_idx @@ to_tsquery('english', $1)");
      expect(cls.clause(1, "t")).toBe(
        "t.name_idx @@ to_tsquery('english', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual("name_idx@@to_tsquery:english:value");
    });

    test("tsquery complex", () => {
      const cls = clause.TsQuery<FullTextData>("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe("name_idx @@ to_tsquery('simple', $1)");
      expect(cls.clause(1, "t")).toBe("t.name_idx @@ to_tsquery('simple', $1)");
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual("name_idx@@to_tsquery:simple:value");
    });

    test("plainto_tsquery string", () => {
      const cls = clause.PlainToTsQuery<FullTextData>("name_idx", "value");
      expect(cls.clause(1)).toBe("name_idx @@ plainto_tsquery('english', $1)");
      expect(cls.clause(1, "t")).toBe(
        "t.name_idx @@ plainto_tsquery('english', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "name_idx@@plainto_tsquery:english:value",
      );
    });

    test("plainto_tsquery complex", () => {
      const cls = clause.PlainToTsQuery<FullTextData>("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe("name_idx @@ plainto_tsquery('simple', $1)");
      expect(cls.clause(1, "t")).toBe(
        "t.name_idx @@ plainto_tsquery('simple', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "name_idx@@plainto_tsquery:simple:value",
      );
    });

    test("phraseto_tsquery string", () => {
      const cls = clause.PhraseToTsQuery<FullTextData>("name_idx", "value");
      expect(cls.clause(1)).toBe("name_idx @@ phraseto_tsquery('english', $1)");
      expect(cls.clause(1, "t")).toBe(
        "t.name_idx @@ phraseto_tsquery('english', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "name_idx@@phraseto_tsquery:english:value",
      );
    });

    test("phraseto_tsquery complex", () => {
      const cls = clause.PhraseToTsQuery<FullTextData>("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe("name_idx @@ phraseto_tsquery('simple', $1)");
      expect(cls.clause(1, "t")).toBe(
        "t.name_idx @@ phraseto_tsquery('simple', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "name_idx@@phraseto_tsquery:simple:value",
      );
    });

    test("websearch_to_tsquery string", () => {
      const cls = clause.WebsearchToTsQuery<FullTextData>("name_idx", "value");
      expect(cls.clause(1)).toBe(
        "name_idx @@ websearch_to_tsquery('english', $1)",
      );
      expect(cls.clause(1, "t")).toBe(
        "t.name_idx @@ websearch_to_tsquery('english', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "name_idx@@websearch_to_tsquery:english:value",
      );
    });

    test("websearch_to_tsquery complex", () => {
      const cls = clause.WebsearchToTsQuery<FullTextData>("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe(
        "name_idx @@ websearch_to_tsquery('simple', $1)",
      );
      expect(cls.clause(1, "t")).toBe(
        "t.name_idx @@ websearch_to_tsquery('simple', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "name_idx@@websearch_to_tsquery:simple:value",
      );
    });

    test("tsvectorcol_tsquery string", () => {
      const cls = clause.TsVectorColTsQuery<FullTextData>("name_idx", "value");
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ to_tsquery('english', $1)",
      );
      expect(cls.clause(1, "t")).toBe(
        "to_tsvector(t.name_idx) @@ to_tsquery('english', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@to_tsquery:english:value",
      );
    });

    test("tsvectorcol_tsquery complex", () => {
      const cls = clause.TsVectorColTsQuery<FullTextData>("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ to_tsquery('simple', $1)",
      );
      expect(cls.clause(1, "t")).toBe(
        "to_tsvector(t.name_idx) @@ to_tsquery('simple', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@to_tsquery:simple:value",
      );
    });

    test("tsvectorcol_plainto_tsquery string", () => {
      const cls = clause.TsVectorPlainToTsQuery<FullTextData>(
        "name_idx",
        "value",
      );
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ plainto_tsquery('english', $1)",
      );
      expect(cls.clause(1, "t")).toBe(
        "to_tsvector(t.name_idx) @@ plainto_tsquery('english', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@plainto_tsquery:english:value",
      );
    });

    test("tsvectorcol_plainto_tsquery complex", () => {
      const cls = clause.TsVectorPlainToTsQuery<FullTextData>("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ plainto_tsquery('simple', $1)",
      );
      expect(cls.clause(1, "t")).toBe(
        "to_tsvector(t.name_idx) @@ plainto_tsquery('simple', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@plainto_tsquery:simple:value",
      );
    });

    test("tsvectorcol__phraseto_tsquery string", () => {
      const cls = clause.TsVectorPhraseToTsQuery<FullTextData>(
        "name_idx",
        "value",
      );
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ phraseto_tsquery('english', $1)",
      );
      expect(cls.clause(1, "t")).toBe(
        "to_tsvector(t.name_idx) @@ phraseto_tsquery('english', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@phraseto_tsquery:english:value",
      );
    });

    test("tsvectorcol_phraseto_tsquery complex", () => {
      const cls = clause.TsVectorPhraseToTsQuery("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ phraseto_tsquery('simple', $1)",
      );
      expect(cls.clause(1, "t")).toBe(
        "to_tsvector(t.name_idx) @@ phraseto_tsquery('simple', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@phraseto_tsquery:simple:value",
      );
    });

    test("tsvectorcol_websearch_to_tsquery string", () => {
      const cls = clause.TsVectorWebsearchToTsQuery<FullTextData>(
        "name_idx",
        "value",
      );
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ websearch_to_tsquery('english', $1)",
      );
      expect(cls.clause(1, "t")).toBe(
        "to_tsvector(t.name_idx) @@ websearch_to_tsquery('english', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@websearch_to_tsquery:english:value",
      );
    });

    test("websearch_to_tsquery complex", () => {
      const cls = clause.TsVectorWebsearchToTsQuery<FullTextData>("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ websearch_to_tsquery('simple', $1)",
      );
      expect(cls.clause(1, "t")).toBe(
        "to_tsvector(t.name_idx) @@ websearch_to_tsquery('simple', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@websearch_to_tsquery:simple:value",
      );
    });
  });

  describe("pagination multiple cols query", () => {
    test(">", () => {
      const cls = clause.PaginationMultipleColsSubQuery<EventData>(
        "start_time",
        ">",
        "events",
        "id",
        "fooo",
      );
      expect(cls.clause(1)).toBe(
        "(start_time > (SELECT start_time FROM events WHERE id = $1) OR (start_time = (SELECT start_time FROM events WHERE id = $2) AND id > $3))",
      );
      expect(cls.clause(1, "t")).toBe(
        "(t.start_time > (SELECT t.start_time FROM events WHERE t.id = $1) OR (t.start_time = (SELECT t.start_time FROM events WHERE t.id = $2) AND t.id > $3))",
      );
      expect(cls.columns()).toStrictEqual(["start_time"]);
      expect(cls.values()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.logValues()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.instanceKey()).toEqual("start_time->-events-id-fooo");
    });

    test("> clause 3", () => {
      const cls = clause.PaginationMultipleColsSubQuery<EventData>(
        "start_time",
        ">",
        "events",
        "id",
        "fooo",
      );
      expect(cls.clause(3)).toBe(
        "(start_time > (SELECT start_time FROM events WHERE id = $3) OR (start_time = (SELECT start_time FROM events WHERE id = $4) AND id > $5))",
      );
      expect(cls.clause(3, "t")).toBe(
        "(t.start_time > (SELECT t.start_time FROM events WHERE t.id = $3) OR (t.start_time = (SELECT t.start_time FROM events WHERE t.id = $4) AND t.id > $5))",
      );
      expect(cls.columns()).toStrictEqual(["start_time"]);
      expect(cls.values()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.logValues()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.instanceKey()).toEqual("start_time->-events-id-fooo");
    });

    test("<", () => {
      const cls = clause.PaginationMultipleColsSubQuery<EventData>(
        "start_time",
        "<",
        "events",
        "id",
        "fooo",
      );
      expect(cls.clause(1)).toBe(
        "(start_time < (SELECT start_time FROM events WHERE id = $1) OR (start_time = (SELECT start_time FROM events WHERE id = $2) AND id < $3))",
      );
      expect(cls.clause(1, "t")).toBe(
        "(t.start_time < (SELECT t.start_time FROM events WHERE t.id = $1) OR (t.start_time = (SELECT t.start_time FROM events WHERE t.id = $2) AND t.id < $3))",
      );
      expect(cls.columns()).toStrictEqual(["start_time"]);
      expect(cls.values()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.logValues()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.instanceKey()).toEqual("start_time-<-events-id-fooo");
    });
  });

  describe("rhs", () => {
    test("add", () => {
      const cls = clause.Add<BalanceData>("balance", 4);
      expect(cls.clause(1)).toBe("balance + $1");
      expect(cls.clause(2)).toBe("balance + $2");
      expect(cls.clause(1, "t")).toBe("t.balance + $1");
      expect(cls.clause(2, "t")).toBe("t.balance + $2");
      expect(cls.columns()).toStrictEqual(["balance"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("balance+4");
    });

    test("subtract", () => {
      const cls = clause.Subtract<BalanceData>("balance", 4);
      expect(cls.clause(1)).toBe("balance - $1");
      expect(cls.clause(2)).toBe("balance - $2");
      expect(cls.clause(1, "t")).toBe("t.balance - $1");
      expect(cls.clause(2, "t")).toBe("t.balance - $2");
      expect(cls.columns()).toStrictEqual(["balance"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("balance-4");
    });

    test("divide", () => {
      const cls = clause.Divide<BalanceData>("balance", 4);
      expect(cls.clause(1)).toBe("balance / $1");
      expect(cls.clause(2)).toBe("balance / $2");
      expect(cls.clause(1, "t")).toBe("t.balance / $1");
      expect(cls.clause(2, "t")).toBe("t.balance / $2");
      expect(cls.columns()).toStrictEqual(["balance"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("balance/4");
    });

    test("multiply", () => {
      const cls = clause.Multiply<BalanceData>("balance", 4);
      expect(cls.clause(1)).toBe("balance * $1");
      expect(cls.clause(2)).toBe("balance * $2");
      expect(cls.clause(1, "t")).toBe("t.balance * $1");
      expect(cls.clause(2, "t")).toBe("t.balance * $2");
      expect(cls.columns()).toStrictEqual(["balance"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("balance*4");
    });

    test("modulo", () => {
      const cls = clause.Modulo<BalanceData>("balance", 4);
      expect(cls.clause(1)).toBe("balance % $1");
      expect(cls.clause(2)).toBe("balance % $2");
      expect(cls.clause(1, "t")).toBe("t.balance % $1");
      expect(cls.clause(2, "t")).toBe("t.balance % $2");
      expect(cls.columns()).toStrictEqual(["balance"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("balance%4");
    });
  });

  describe("like queries", () => {
    test("contains", () => {
      const cls = clause.Contains<ExampleData>("bar", "foo");
      expect(cls.clause(1)).toBe("bar LIKE $1");
      expect(cls.clause(2)).toBe("bar LIKE $2");
      expect(cls.clause(1, "t")).toBe("t.bar LIKE $1");
      expect(cls.clause(2, "t")).toBe("t.bar LIKE $2");
      expect(cls.columns()).toStrictEqual(["bar"]);
      expect(cls.values()).toStrictEqual(["%foo%"]);
      expect(cls.logValues()).toStrictEqual(["%foo%"]);
      expect(cls.instanceKey()).toEqual("barLIKE%foo%");
    });

    test("contains ignore case", () => {
      const cls = clause.ContainsIgnoreCase<ExampleData>("bar", "foo");
      expect(cls.clause(1)).toBe("bar ILIKE $1");
      expect(cls.clause(2)).toBe("bar ILIKE $2");
      expect(cls.clause(1, "t")).toBe("t.bar ILIKE $1");
      expect(cls.clause(2, "t")).toBe("t.bar ILIKE $2");
      expect(cls.columns()).toStrictEqual(["bar"]);
      expect(cls.values()).toStrictEqual(["%foo%"]);
      expect(cls.logValues()).toStrictEqual(["%foo%"]);
      expect(cls.instanceKey()).toEqual("barILIKE%foo%");
    });

    test("starts_with", () => {
      const cls = clause.StartsWith<ExampleData>("bar", "foo");
      expect(cls.clause(1)).toBe("bar LIKE $1");
      expect(cls.clause(2)).toBe("bar LIKE $2");
      expect(cls.clause(1, "t")).toBe("t.bar LIKE $1");
      expect(cls.clause(2, "t")).toBe("t.bar LIKE $2");
      expect(cls.columns()).toStrictEqual(["bar"]);
      expect(cls.values()).toStrictEqual(["foo%"]);
      expect(cls.logValues()).toStrictEqual(["foo%"]);
      expect(cls.instanceKey()).toEqual("barLIKEfoo%");
    });

    test("starts_with ignore case", () => {
      const cls = clause.StartsWithIgnoreCase<ExampleData>("bar", "foo");
      expect(cls.clause(1)).toBe("bar ILIKE $1");
      expect(cls.clause(2)).toBe("bar ILIKE $2");
      expect(cls.clause(1, "t")).toBe("t.bar ILIKE $1");
      expect(cls.clause(2, "t")).toBe("t.bar ILIKE $2");
      expect(cls.columns()).toStrictEqual(["bar"]);
      expect(cls.values()).toStrictEqual(["foo%"]);
      expect(cls.logValues()).toStrictEqual(["foo%"]);
      expect(cls.instanceKey()).toEqual("barILIKEfoo%");
    });

    test("ends_with", () => {
      const cls = clause.EndsWith<ExampleData>("bar", "foo");
      expect(cls.clause(1)).toBe("bar LIKE $1");
      expect(cls.clause(2)).toBe("bar LIKE $2");
      expect(cls.clause(1, "t")).toBe("t.bar LIKE $1");
      expect(cls.clause(2, "t")).toBe("t.bar LIKE $2");
      expect(cls.columns()).toStrictEqual(["bar"]);
      expect(cls.values()).toStrictEqual(["%foo"]);
      expect(cls.logValues()).toStrictEqual(["%foo"]);
      expect(cls.instanceKey()).toEqual("barLIKE%foo");
    });

    test("ends_with ignore_case", () => {
      const cls = clause.EndsWithIgnoreCase<ExampleData>("bar", "foo");
      expect(cls.clause(1)).toBe("bar ILIKE $1");
      expect(cls.clause(2)).toBe("bar ILIKE $2");
      expect(cls.clause(1, "t")).toBe("t.bar ILIKE $1");
      expect(cls.clause(2, "t")).toBe("t.bar ILIKE $2");
      expect(cls.columns()).toStrictEqual(["bar"]);
      expect(cls.values()).toStrictEqual(["%foo"]);
      expect(cls.logValues()).toStrictEqual(["%foo"]);
      expect(cls.instanceKey()).toEqual("barILIKE%foo");
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
      const cls = clause.Eq<ExampleData>("id", 4);
      expect(cls.clause(1)).toBe("id = ?");
      expect(cls.clause(2)).toBe("id = ?");
      expect(cls.clause(1, "t")).toBe("t.id = ?");
      expect(cls.clause(2, "t")).toBe("t.id = ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id=4");
    });

    test("sensitive value", () => {
      const cls = clause.Eq<ExampleData>("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id = ?");
      expect(cls.clause(2)).toBe("id = ?");
      expect(cls.clause(1, "t")).toBe("t.id = ?");
      expect(cls.clause(2, "t")).toBe("t.id = ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id=4");
    });
  });

  describe("Greater", () => {
    test("normal", () => {
      const cls = clause.Greater<ExampleData>("id", 4);
      expect(cls.clause(1)).toBe("id > ?");
      expect(cls.clause(2)).toBe("id > ?");
      expect(cls.clause(1, "t")).toBe("t.id > ?");
      expect(cls.clause(2, "t")).toBe("t.id > ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id>4");
    });

    test("sensitive value", () => {
      const cls = clause.Greater<ExampleData>("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id > ?");
      expect(cls.clause(2)).toBe("id > ?");
      expect(cls.clause(1, "t")).toBe("t.id > ?");
      expect(cls.clause(2, "t")).toBe("t.id > ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id>4");
    });
  });

  describe("Less", () => {
    test("normal", () => {
      const cls = clause.Less<ExampleData>("id", 4);
      expect(cls.clause(1)).toBe("id < ?");
      expect(cls.clause(2)).toBe("id < ?");
      expect(cls.clause(1, "t")).toBe("t.id < ?");
      expect(cls.clause(2, "t")).toBe("t.id < ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id<4");
    });

    test("sensitive value", () => {
      const cls = clause.Less<ExampleData>("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id < ?");
      expect(cls.clause(2)).toBe("id < ?");
      expect(cls.clause(1, "t")).toBe("t.id < ?");
      expect(cls.clause(2, "t")).toBe("t.id < ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id<4");
    });
  });

  describe("GreaterEq", () => {
    test("normal", () => {
      const cls = clause.GreaterEq<ExampleData>("id", 4);
      expect(cls.clause(1)).toBe("id >= ?");
      expect(cls.clause(2)).toBe("id >= ?");
      expect(cls.clause(1, "t")).toBe("t.id >= ?");
      expect(cls.clause(2, "t")).toBe("t.id >= ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id>=4");
    });

    test("sensitive value", () => {
      const cls = clause.GreaterEq<ExampleData>("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id >= ?");
      expect(cls.clause(2)).toBe("id >= ?");
      expect(cls.clause(1, "t")).toBe("t.id >= ?");
      expect(cls.clause(2, "t")).toBe("t.id >= ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id>=4");
    });
  });

  describe("LessEq", () => {
    test("normal", () => {
      const cls = clause.LessEq<ExampleData>("id", 4);
      expect(cls.clause(1)).toBe("id <= ?");
      expect(cls.clause(2)).toBe("id <= ?");
      expect(cls.clause(1, "t")).toBe("t.id <= ?");
      expect(cls.clause(2, "t")).toBe("t.id <= ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id<=4");
    });

    test("sensitive value", () => {
      const cls = clause.LessEq<ExampleData>("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id <= ?");
      expect(cls.clause(2)).toBe("id <= ?");
      expect(cls.clause(1, "t")).toBe("t.id <= ?");
      expect(cls.clause(2, "t")).toBe("t.id <= ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id<=4");
    });
  });

  describe("And", () => {
    test("2 items", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", "foo"),
      );
      expect(cls.clause(1)).toBe("id1 = ? AND id2 = ?");
      expect(cls.clause(1, "t")).toBe("t.id1 = ? AND t.id2 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo");
    });

    test("3 items", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", "foo"),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = ? AND id2 = ? AND id3 = ?");
      expect(cls.clause(1, "t")).toBe("t.id1 = ? AND t.id2 = ? AND t.id3 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.clause(1, "t")).toBe("t.id1 = ? AND t.id2 = ? AND t.id3 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "***", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("composite And with And first", () => {
      const cls = clause.And<EdgeData>(
        clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = ? AND id2 = ? AND id3 = ?");
      expect(cls.clause(1, "t")).toBe("t.id1 = ? AND t.id2 = ? AND t.id3 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("composite And with And after", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.And(clause.Eq("id2", "foo"), clause.Eq("id3", "baz")),
      );
      expect(cls.clause(1)).toBe("id1 = ? AND id2 = ? AND id3 = ?");
      expect(cls.clause(1, "t")).toBe("t.id1 = ? AND t.id2 = ? AND t.id3 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });

    test("composite And with sensitive value in there", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.And(
          clause.Eq("id2", "foo"),
          clause.Eq("id3", clause.sensitiveValue("baz")),
        ),
      );
      expect(cls.clause(1)).toBe("id1 = ? AND id2 = ? AND id3 = ?");
      expect(cls.clause(1, "t")).toBe("t.id1 = ? AND t.id2 = ? AND t.id3 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "***"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });
  });

  describe("Or", () => {
    test("2 items", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", "foo"),
      );
      expect(cls.clause(1)).toBe("id1 = ? OR id2 = ?");
      expect(cls.clause(1, "t")).toBe("t.id1 = ? OR t.id2 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo");
    });

    test("3 items", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", "foo"),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = ? OR id2 = ? OR id3 = ?");
      expect(cls.clause(1, "t")).toBe("t.id1 = ? OR t.id2 = ? OR t.id3 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("3 items. one sensitive value", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Eq("id2", clause.sensitiveValue("foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = ? OR id2 = ? OR id3 = ?");
      expect(cls.clause(1, "t")).toBe("t.id1 = ? OR t.id2 = ? OR t.id3 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "***", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("composite Or with Or first", () => {
      const cls = clause.Or<EdgeData>(
        clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        clause.Eq("id3", "baz"),
      );
      expect(cls.clause(1)).toBe("id1 = ? OR id2 = ? OR id3 = ?");
      expect(cls.clause(1, "t")).toBe("t.id1 = ? OR t.id2 = ? OR t.id3 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("composite Or with Or after", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Or(clause.Eq("id2", "foo"), clause.Eq("id3", "baz")),
      );
      expect(cls.clause(1)).toBe("id1 = ? OR id2 = ? OR id3 = ?");
      expect(cls.clause(1, "t")).toBe("t.id1 = ? OR t.id2 = ? OR t.id3 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });

    test("composite or with sensitive value in there", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id1", "iddd"),
        clause.Or(
          clause.Eq("id2", "foo"),
          clause.Eq("id3", clause.sensitiveValue("baz")),
        ),
      );
      expect(cls.clause(1)).toBe("id1 = ? OR id2 = ? OR id3 = ?");
      expect(cls.clause(1, "t")).toBe("t.id1 = ? OR t.id2 = ? OR t.id3 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "***"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });
  });

  describe("nested and/or", () => {
    test("OR nested in AND", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id3", "bar"),
        clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
      );
      expect(cls.clause(1)).toBe("id3 = ? AND (id1 = ? OR id2 = ?)");
      expect(cls.clause(1, "t")).toBe("t.id3 = ? AND (t.id1 = ? OR t.id2 = ?)");
      expect(cls.columns()).toStrictEqual(["id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id3=bar AND (id1=iddd OR id2=foo)");
    });

    test("AND nested in Or", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id3", "bar"),
        clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
      );
      expect(cls.clause(1)).toBe("id3 = ? OR (id1 = ? AND id2 = ?)");
      expect(cls.clause(1, "t")).toBe("t.id3 = ? OR (t.id1 = ? AND t.id2 = ?)");
      expect(cls.columns()).toStrictEqual(["id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id3=bar OR (id1=iddd AND id2=foo)");
    });

    test("Or nested in AND nested in OR", () => {
      const cls = clause.Or<EdgeData>(
        clause.Eq("id4", "baz"),
        clause.And(
          clause.Eq("id3", "bar"),
          clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        ),
      );
      expect(cls.clause(1)).toBe(
        "id4 = ? OR (id3 = ? AND (id1 = ? OR id2 = ?))",
      );
      expect(cls.clause(1, "t")).toBe(
        "t.id4 = ? OR (t.id3 = ? AND (t.id1 = ? OR t.id2 = ?))",
      );
      expect(cls.columns()).toStrictEqual(["id4", "id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toBe(
        "id4=baz OR (id3=bar AND (id1=iddd OR id2=foo))",
      );
    });

    test("And nested in OR nested in AND", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id4", "baz"),
        clause.Or(
          clause.Eq("id3", "bar"),
          clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        ),
      );
      expect(cls.clause(1)).toBe(
        "id4 = ? AND (id3 = ? OR (id1 = ? AND id2 = ?))",
      );
      expect(cls.clause(1, "t")).toBe(
        "t.id4 = ? AND (t.id3 = ? OR (t.id1 = ? AND t.id2 = ?))",
      );
      expect(cls.columns()).toStrictEqual(["id4", "id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toBe(
        "id4=baz AND (id3=bar OR (id1=iddd AND id2=foo))",
      );
    });

    test("complexx ", () => {
      const cls = clause.And<EdgeData>(
        clause.Eq("id4", "baz"),
        clause.Or(
          clause.Eq("id3", "bar"),
          clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
          clause.Or(clause.Eq("id5", "whaa"), clause.Eq("id6", "indeed")),
        ),
      );
      expect(cls.clause(1)).toBe(
        "id4 = ? AND (id3 = ? OR (id1 = ? AND id2 = ?) OR id5 = ? OR id6 = ?)",
        // could also do this...
        //         "id4 = ? AND (id3 = ? OR (id1 = ? AND id2 = ?) OR (id5 = ? OR id6 = ?))",
      );
      expect(cls.clause(1, "t")).toBe(
        "t.id4 = ? AND (t.id3 = ? OR (t.id1 = ? AND t.id2 = ?) OR t.id5 = ? OR t.id6 = ?)",
        // could also do this...
        //         "id4 = ? AND (id3 = ? OR (id1 = ? AND id2 = ?) OR (id5 = ? OR id6 = ?))",
      );
      expect(cls.columns()).toStrictEqual([
        "id4",
        "id3",
        "id1",
        "id2",
        "id5",
        "id6",
      ]);
      expect(cls.values()).toStrictEqual([
        "baz",
        "bar",
        "iddd",
        "foo",
        "whaa",
        "indeed",
      ]);
      expect(cls.logValues()).toStrictEqual([
        "baz",
        "bar",
        "iddd",
        "foo",
        "whaa",
        "indeed",
      ]);
      expect(cls.instanceKey()).toBe(
        "id4=baz AND (id3=bar OR (id1=iddd AND id2=foo) OR id5=whaa OR id6=indeed)",
      );
    });
  });

  describe("In", () => {
    test("1 arg", () => {
      const cls = clause.In<ExampleData>("id", 1);
      expect(cls.clause(1)).toBe("id = ?");
      expect(cls.clause(1, "t")).toBe("t.id = ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1]);
      expect(cls.logValues()).toStrictEqual([1]);
      expect(cls.instanceKey()).toEqual("in:id:1");
    });

    test("not in. 1 arg", () => {
      const cls = clause.DBTypeNotIn<ExampleData>("id", [1], "integer");
      expect(cls.clause(1)).toBe("id != ?");
      expect(cls.clause(1, "t")).toBe("t.id != ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1]);
      expect(cls.logValues()).toStrictEqual([1]);
      expect(cls.instanceKey()).toEqual("not in:id:1");
    });

    test("spread args", () => {
      const cls = clause.In<ExampleData>("id", 1, 2, 3);
      expect(cls.clause(1)).toBe("id IN (?, ?, ?)");
      expect(cls.clause(1, "t")).toBe("t.id IN (?, ?, ?)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("spread args with sensitive value", () => {
      const cls = clause.In<ExampleData>("id", 1, 2, clause.sensitiveValue(3));
      expect(cls.clause(1)).toBe("id IN (?, ?, ?)");
      expect(cls.clause(1, "t")).toBe("t.id IN (?, ?, ?)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, "*"]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("list", () => {
      const cls = clause.In<ExampleData>("id", ...[1, 2, 3]);
      expect(cls.clause(1)).toBe("id IN (?, ?, ?)");
      expect(cls.clause(1, "t")).toBe("t.id IN (?, ?, ?)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("list with sensitive value", () => {
      const cls = clause.In<ExampleData>(
        "id",
        ...[1, clause.sensitiveValue(2), 3],
      );
      expect(cls.clause(1)).toBe("id IN (?, ?, ?)");
      expect(cls.clause(1, "t")).toBe("t.id IN (?, ?, ?)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, "*", 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });
  });

  describe("pagination multiple cols query", () => {
    test(">", () => {
      const cls = clause.PaginationMultipleColsSubQuery<EventData>(
        "start_time",
        ">",
        "events",
        "id",
        "fooo",
      );
      expect(cls.clause(1)).toBe(
        "(start_time > (SELECT start_time FROM events WHERE id = ?) OR (start_time = (SELECT start_time FROM events WHERE id = ?) AND id > ?))",
      );
      expect(cls.clause(1, "t")).toBe(
        "(t.start_time > (SELECT t.start_time FROM events WHERE t.id = ?) OR (t.start_time = (SELECT t.start_time FROM events WHERE t.id = ?) AND t.id > ?))",
      );
      expect(cls.columns()).toStrictEqual(["start_time"]);
      expect(cls.values()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.logValues()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.instanceKey()).toEqual("start_time->-events-id-fooo");
    });

    test("> clause 3", () => {
      const cls = clause.PaginationMultipleColsSubQuery<EventData>(
        "start_time",
        ">",
        "events",
        "id",
        "fooo",
      );
      expect(cls.clause(3)).toBe(
        "(start_time > (SELECT start_time FROM events WHERE id = ?) OR (start_time = (SELECT start_time FROM events WHERE id = ?) AND id > ?))",
      );
      expect(cls.clause(3, "t")).toBe(
        "(t.start_time > (SELECT t.start_time FROM events WHERE t.id = ?) OR (t.start_time = (SELECT t.start_time FROM events WHERE t.id = ?) AND t.id > ?))",
      );
      expect(cls.columns()).toStrictEqual(["start_time"]);
      expect(cls.values()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.logValues()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.instanceKey()).toEqual("start_time->-events-id-fooo");
    });

    test("<", () => {
      const cls = clause.PaginationMultipleColsSubQuery<EventData>(
        "start_time",
        "<",
        "events",
        "id",
        "fooo",
      );
      expect(cls.clause(1)).toBe(
        "(start_time < (SELECT start_time FROM events WHERE id = ?) OR (start_time = (SELECT start_time FROM events WHERE id = ?) AND id < ?))",
      );
      expect(cls.clause(1, "t")).toBe(
        "(t.start_time < (SELECT t.start_time FROM events WHERE t.id = ?) OR (t.start_time = (SELECT t.start_time FROM events WHERE t.id = ?) AND t.id < ?))",
      );
      expect(cls.columns()).toStrictEqual(["start_time"]);
      expect(cls.values()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.logValues()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.instanceKey()).toEqual("start_time-<-events-id-fooo");
    });
  });

  describe("rhs", () => {
    test("add", () => {
      const cls = clause.Add<BalanceData>("balance", 4);
      expect(cls.clause(1)).toBe("balance + ?");
      expect(cls.clause(2)).toBe("balance + ?");
      expect(cls.clause(1, "t")).toBe("t.balance + ?");
      expect(cls.clause(2, "t")).toBe("t.balance + ?");
      expect(cls.columns()).toStrictEqual(["balance"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("balance+4");
    });

    test("subtract", () => {
      const cls = clause.Subtract<BalanceData>("balance", 4);
      expect(cls.clause(1)).toBe("balance - ?");
      expect(cls.clause(2)).toBe("balance - ?");
      expect(cls.clause(1, "t")).toBe("t.balance - ?");
      expect(cls.clause(2, "t")).toBe("t.balance - ?");
      expect(cls.columns()).toStrictEqual(["balance"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("balance-4");
    });

    test("divide", () => {
      const cls = clause.Divide<BalanceData>("balance", 4);
      expect(cls.clause(1)).toBe("balance / ?");
      expect(cls.clause(2)).toBe("balance / ?");
      expect(cls.clause(1, "t")).toBe("t.balance / ?");
      expect(cls.clause(2, "t")).toBe("t.balance / ?");
      expect(cls.columns()).toStrictEqual(["balance"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("balance/4");
    });

    test("multiply", () => {
      const cls = clause.Multiply<BalanceData>("balance", 4);
      expect(cls.clause(1)).toBe("balance * ?");
      expect(cls.clause(2)).toBe("balance * ?");
      expect(cls.clause(1, "t")).toBe("t.balance * ?");
      expect(cls.clause(2, "t")).toBe("t.balance * ?");
      expect(cls.columns()).toStrictEqual(["balance"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("balance*4");
    });

    test("modulo", () => {
      const cls = clause.Modulo<BalanceData>("balance", 4);
      expect(cls.clause(1)).toBe("balance % ?");
      expect(cls.clause(2)).toBe("balance % ?");
      expect(cls.clause(1, "t")).toBe("t.balance % ?");
      expect(cls.clause(2, "t")).toBe("t.balance % ?");
      expect(cls.columns()).toStrictEqual(["balance"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("balance%4");
    });
  });
});
