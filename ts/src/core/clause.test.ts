import { v1 } from "uuid";
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
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id=4");
    });

    test("sensitive value", () => {
      const cls = clause.Eq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id = $1");
      expect(cls.clause(2)).toBe("id = $2");
      expect(cls.columns()).toStrictEqual(["id"]);
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
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id!=4");
    });

    test("sensitive value", () => {
      const cls = clause.NotEq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id != $1");
      expect(cls.clause(2)).toBe("id != $2");
      expect(cls.columns()).toStrictEqual(["id"]);
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
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id>4");
    });

    test("sensitive value", () => {
      const cls = clause.Greater("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id > $1");
      expect(cls.clause(2)).toBe("id > $2");
      expect(cls.columns()).toStrictEqual(["id"]);
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
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id<4");
    });

    test("sensitive value", () => {
      const cls = clause.Less("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id < $1");
      expect(cls.clause(2)).toBe("id < $2");
      expect(cls.columns()).toStrictEqual(["id"]);
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
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id>=4");
    });

    test("sensitive value", () => {
      const cls = clause.GreaterEq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id >= $1");
      expect(cls.clause(2)).toBe("id >= $2");
      expect(cls.columns()).toStrictEqual(["id"]);
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
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id<=4");
    });

    test("sensitive value", () => {
      const cls = clause.LessEq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id <= $1");
      expect(cls.clause(2)).toBe("id <= $2");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id<=4");
    });
  });

  describe("And", () => {
    test("2 items", () => {
      const cls = clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo"));
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2");
      expect(cls.columns()).toStrictEqual(["id1", "id2"]);
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
      expect(cls.clause(1)).toBe("id1 = $1 AND id2 = $2 AND id3 = $3");
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "***"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });
  });

  describe("Or", () => {
    test("2 items", () => {
      const cls = clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo"));
      expect(cls.clause(1)).toBe("id1 = $1 OR id2 = $2");
      expect(cls.columns()).toStrictEqual(["id1", "id2"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "***"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });
  });

  describe("nested and/or", () => {
    test("OR nested in AND", () => {
      const cls = clause.And(
        clause.Eq("id3", "bar"),
        clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
      );
      expect(cls.clause(1)).toBe("id3 = $1 AND (id1 = $2 OR id2 = $3)");
      expect(cls.columns()).toStrictEqual(["id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id3=bar AND (id1=iddd OR id2=foo)");
    });

    test("AND nested in Or", () => {
      const cls = clause.Or(
        clause.Eq("id3", "bar"),
        clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
      );
      expect(cls.clause(1)).toBe("id3 = $1 OR (id1 = $2 AND id2 = $3)");
      expect(cls.columns()).toStrictEqual(["id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id3=bar OR (id1=iddd AND id2=foo)");
    });

    test("Or nested in AND nested in OR", () => {
      const cls = clause.Or(
        clause.Eq("id4", "baz"),
        clause.And(
          clause.Eq("id3", "bar"),
          clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        ),
      );
      expect(cls.clause(1)).toBe(
        "id4 = $1 OR (id3 = $2 AND (id1 = $3 OR id2 = $4))",
      );
      expect(cls.columns()).toStrictEqual(["id4", "id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toBe(
        "id4=baz OR (id3=bar AND (id1=iddd OR id2=foo))",
      );
    });

    test("And nested in OR nested in AND", () => {
      const cls = clause.And(
        clause.Eq("id4", "baz"),
        clause.Or(
          clause.Eq("id3", "bar"),
          clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        ),
      );
      expect(cls.clause(1)).toBe(
        "id4 = $1 AND (id3 = $2 OR (id1 = $3 AND id2 = $4))",
      );
      expect(cls.columns()).toStrictEqual(["id4", "id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toBe(
        "id4=baz AND (id3=bar OR (id1=iddd AND id2=foo))",
      );
    });

    test("complexx ", () => {
      const cls = clause.And(
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
      const cls = clause.And(
        clause.Eq("id3", null),
        clause.Or(clause.Eq("id1", null), clause.Eq("id2", "foo")),
      );
      expect(cls.clause(1)).toBe("id3 IS NULL AND (id1 IS NULL OR id2 = $1)");
      expect(cls.columns()).toStrictEqual(["id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["foo"]);
      expect(cls.logValues()).toStrictEqual(["foo"]);
      expect(cls.instanceKey()).toEqual(
        "id3 IS NULL AND (id1 IS NULL OR id2=foo)",
      );
    });

    test("AND nested in OR", () => {
      const cls = clause.Or(
        clause.Eq("id3", null),
        clause.And(clause.Eq("id1", null), clause.Eq("id2", "foo")),
      );
      expect(cls.clause(1)).toBe("id3 IS NULL OR (id1 IS NULL AND id2 = $1)");
      expect(cls.columns()).toStrictEqual(["id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["foo"]);
      expect(cls.logValues()).toStrictEqual(["foo"]);
      expect(cls.instanceKey()).toEqual(
        "id3 IS NULL OR (id1 IS NULL AND id2=foo)",
      );
    });

    test("Or nested in AND nested in OR", () => {
      const cls = clause.Or(
        clause.Eq("id4", "baz"),
        clause.And(
          clause.Eq("id3", null),
          clause.Or(clause.Eq("id1", null), clause.Eq("id2", "foo")),
        ),
      );
      expect(cls.clause(1)).toBe(
        "id4 = $1 OR (id3 IS NULL AND (id1 IS NULL OR id2 = $2))",
      );
      expect(cls.columns()).toStrictEqual(["id4", "id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["baz", "foo"]);
      expect(cls.logValues()).toStrictEqual(["baz", "foo"]);
      expect(cls.instanceKey()).toBe(
        "id4=baz OR (id3 IS NULL AND (id1 IS NULL OR id2=foo))",
      );
    });

    test("complexx ", () => {
      const cls = clause.And(
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

  describe("In", () => {
    test("1 arg", () => {
      const cls = clause.In("id", 1);
      expect(cls.clause(1)).toBe("id = $1");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1]);
      expect(cls.logValues()).toStrictEqual([1]);
      expect(cls.instanceKey()).toEqual("in:id:1");
    });

    test("spread args", () => {
      const cls = clause.In("id", 1, 2, 3);
      expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("spread args with sensitive value", () => {
      const cls = clause.In("id", 1, 2, clause.sensitiveValue(3));
      expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, "*"]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("list", () => {
      const cls = clause.In("id", ...[1, 2, 3]);
      expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("list with sensitive value", () => {
      const cls = clause.In("id", ...[1, clause.sensitiveValue(2), 3]);
      expect(cls.clause(1)).toBe("id IN ($1, $2, $3)");
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

        const cls = clause.In("id", ids);
        expect(cls.clause(1)).toBe(
          "id IN (VALUES($1::uuid), ($2), ($3), ($4), ($5))",
        );
        expect(cls.columns()).toStrictEqual(["id"]);
        expect(cls.values()).toStrictEqual(ids);
        expect(cls.logValues()).toStrictEqual(ids);
        expect(cls.instanceKey()).toEqual(`in:id:${ids.join(",")}`);
      });

      test("int", () => {
        const ids = [1, 2, 3, 4, 5];

        const cls = clause.In("id", ids, "int");
        expect(cls.clause(1)).toBe(
          "id IN (VALUES($1::int), ($2), ($3), ($4), ($5))",
        );
        expect(cls.columns()).toStrictEqual(["id"]);
        expect(cls.values()).toStrictEqual(ids);
        expect(cls.logValues()).toStrictEqual(ids);
        expect(cls.instanceKey()).toEqual(`in:id:${ids.join(",")}`);
      });

      test("integer", () => {
        const ids = [1, 2, 3, 4, 5];

        const cls = clause.In("id", ids, "integer");
        expect(cls.clause(1)).toBe(
          "id IN (VALUES($1::integer), ($2), ($3), ($4), ($5))",
        );
        expect(cls.columns()).toStrictEqual(["id"]);
        expect(cls.values()).toStrictEqual(ids);
        expect(cls.logValues()).toStrictEqual(ids);
        expect(cls.instanceKey()).toEqual(`in:id:${ids.join(",")}`);
      });

      test("uuid explicit", () => {
        const ids = [1, 2, 3, 4, 5].map((_) => v1());

        const cls = clause.In("id", ids, "uuid");
        expect(cls.clause(1)).toBe(
          "id IN (VALUES($1::uuid), ($2), ($3), ($4), ($5))",
        );
        expect(cls.columns()).toStrictEqual(["id"]);
        expect(cls.values()).toStrictEqual(ids);
        expect(cls.logValues()).toStrictEqual(ids);
        expect(cls.instanceKey()).toEqual(`in:id:${ids.join(",")}`);
      });
    });
  });

  describe("array", () => {
    test("eq", () => {
      const cls = clause.ArrayEq("ids", 3);
      expect(cls.clause(1)).toBe("$1 = ANY(ids)");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([3]);
      expect(cls.logValues()).toStrictEqual([3]);
      expect(cls.instanceKey()).toEqual("ids=3");
    });

    test("ne", () => {
      const cls = clause.ArrayNotEq("ids", 3);
      expect(cls.clause(1)).toBe("$1 != ANY(ids)");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([3]);
      expect(cls.logValues()).toStrictEqual([3]);
      expect(cls.instanceKey()).toEqual("ids!=3");
    });

    test("contains val", () => {
      const cls = clause.PostgresArrayContainsValue("ids", 3);
      expect(cls.clause(1)).toBe("ids @> $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{3}`]);
      expect(cls.logValues()).toStrictEqual([`{3}`]);
      expect(cls.instanceKey()).toEqual("ids@>3");
    });

    test("contains val:string", () => {
      const cls = clause.PostgresArrayContainsValue("ids", "foo");
      expect(cls.clause(1)).toBe("ids @> $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{foo}`]);
      expect(cls.logValues()).toStrictEqual([`{foo}`]);
      expect(cls.instanceKey()).toEqual("ids@>foo");
    });

    test("contains list", () => {
      const cls = clause.PostgresArrayContains("ids", [3, 4]);
      expect(cls.clause(1)).toBe("ids @> $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{3, 4}`]);
      expect(cls.logValues()).toStrictEqual([`{3, 4}`]);
      expect(cls.instanceKey()).toEqual("ids@>3,4");
    });

    test("contains list string", () => {
      const cls = clause.PostgresArrayContains("ids", ["foo", "bar"]);
      expect(cls.clause(1)).toBe("ids @> $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{foo, bar}`]);
      expect(cls.logValues()).toStrictEqual([`{foo, bar}`]);
      expect(cls.instanceKey()).toEqual("ids@>foo,bar");
    });

    test("not contains val", () => {
      const cls = clause.PostgresArrayNotContainsValue("ids", 3);
      expect(cls.clause(1)).toBe("NOT ids @> $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{3}`]);
      expect(cls.logValues()).toStrictEqual([`{3}`]);
      expect(cls.instanceKey()).toEqual("NOT:ids@>3");
    });

    test("not contains list", () => {
      const cls = clause.PostgresArrayNotContains("ids", [3, 4]);
      expect(cls.clause(1)).toBe("NOT ids @> $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{3, 4}`]);
      expect(cls.logValues()).toStrictEqual([`{3, 4}`]);
      expect(cls.instanceKey()).toEqual("NOT:ids@>3,4");
    });

    test("overlaps", () => {
      const cls = clause.PostgresArrayOverlaps("ids", [3, 4]);
      expect(cls.clause(1)).toBe("ids && $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{3, 4}`]);
      expect(cls.logValues()).toStrictEqual([`{3, 4}`]);
      expect(cls.instanceKey()).toEqual("ids&&3,4");
    });

    test("not overlaps", () => {
      const cls = clause.PostgresArrayNotOverlaps("ids", [3, 4]);
      expect(cls.clause(1)).toBe("NOT ids && $1");
      expect(cls.columns()).toStrictEqual(["ids"]);
      expect(cls.values()).toStrictEqual([`{3, 4}`]);
      expect(cls.logValues()).toStrictEqual([`{3, 4}`]);
      expect(cls.instanceKey()).toEqual("NOT:ids&&3,4");
    });
  });

  describe("jsonb", () => {
    test("eq", () => {
      const cls = clause.JSONPathValuePredicate("jsonb", "$.*", 3, "==");
      expect(cls.clause(1)).toBe("jsonb @@ $1");
      expect(cls.columns()).toStrictEqual(["jsonb"]);
      expect(cls.values()).toStrictEqual(["$.* == 3"]);
      expect(cls.logValues()).toStrictEqual(["$.* == 3"]);
      expect(cls.instanceKey()).toEqual("jsonb$.*3==");
    });

    test("eq string", () => {
      const cls = clause.JSONPathValuePredicate("jsonb", "$.*", "hello", "==");
      expect(cls.clause(1)).toBe("jsonb @@ $1");
      expect(cls.columns()).toStrictEqual(["jsonb"]);
      expect(cls.values()).toStrictEqual(['$.* == "hello"']);
      expect(cls.logValues()).toStrictEqual(['$.* == "hello"']);
      expect(cls.instanceKey()).toEqual("jsonb$.*hello==");
    });

    test("ge", () => {
      const cls = clause.JSONPathValuePredicate("jsonb", "$.*", 3, ">");
      expect(cls.clause(1)).toBe("jsonb @@ $1");
      expect(cls.columns()).toStrictEqual(["jsonb"]);
      expect(cls.values()).toStrictEqual(["$.* > 3"]);
      expect(cls.logValues()).toStrictEqual(["$.* > 3"]);
      expect(cls.instanceKey()).toEqual("jsonb$.*3>");
    });

    test("ne", () => {
      const cls = clause.JSONPathValuePredicate("jsonb", "$.*", 3, "!=");
      expect(cls.clause(1)).toBe("jsonb @@ $1");
      expect(cls.columns()).toStrictEqual(["jsonb"]);
      expect(cls.values()).toStrictEqual(["$.* != 3"]);
      expect(cls.logValues()).toStrictEqual(["$.* != 3"]);
      expect(cls.instanceKey()).toEqual("jsonb$.*3!=");
    });

    test("specific path", () => {
      const cls = clause.JSONPathValuePredicate("jsonb", "$.col", 3, "!=");
      expect(cls.clause(1)).toBe("jsonb @@ $1");
      expect(cls.columns()).toStrictEqual(["jsonb"]);
      expect(cls.values()).toStrictEqual(["$.col != 3"]);
      expect(cls.logValues()).toStrictEqual(["$.col != 3"]);
      expect(cls.instanceKey()).toEqual("jsonb$.col3!=");
    });

    test("specific path arr idx", () => {
      const cls = clause.JSONPathValuePredicate("jsonb", "$.col[*]", 3, "!=");
      expect(cls.clause(1)).toBe("jsonb @@ $1");
      expect(cls.columns()).toStrictEqual(["jsonb"]);
      expect(cls.values()).toStrictEqual(["$.col[*] != 3"]);
      expect(cls.logValues()).toStrictEqual(["$.col[*] != 3"]);
      expect(cls.instanceKey()).toEqual("jsonb$.col[*]3!=");
    });
  });

  describe("full text", () => {
    test("tsquery string", () => {
      const cls = clause.TsQuery("name_idx", "value");
      expect(cls.clause(1)).toBe("name_idx @@ to_tsquery('english', $1)");
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual("name_idx@@to_tsquery:english:value");
    });

    test("tsquery complex", () => {
      const cls = clause.TsQuery("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe("name_idx @@ to_tsquery('simple', $1)");
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual("name_idx@@to_tsquery:simple:value");
    });

    test("plainto_tsquery string", () => {
      const cls = clause.PlainToTsQuery("name_idx", "value");
      expect(cls.clause(1)).toBe("name_idx @@ plainto_tsquery('english', $1)");
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "name_idx@@plainto_tsquery:english:value",
      );
    });

    test("plainto_tsquery complex", () => {
      const cls = clause.PlainToTsQuery("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe("name_idx @@ plainto_tsquery('simple', $1)");
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "name_idx@@plainto_tsquery:simple:value",
      );
    });

    test("phraseto_tsquery string", () => {
      const cls = clause.PhraseToTsQuery("name_idx", "value");
      expect(cls.clause(1)).toBe("name_idx @@ phraseto_tsquery('english', $1)");
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "name_idx@@phraseto_tsquery:english:value",
      );
    });

    test("phraseto_tsquery complex", () => {
      const cls = clause.PhraseToTsQuery("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe("name_idx @@ phraseto_tsquery('simple', $1)");
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "name_idx@@phraseto_tsquery:simple:value",
      );
    });

    test("websearch_to_tsquery string", () => {
      const cls = clause.WebsearchToTsQuery("name_idx", "value");
      expect(cls.clause(1)).toBe(
        "name_idx @@ websearch_to_tsquery('english', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "name_idx@@websearch_to_tsquery:english:value",
      );
    });

    test("websearch_to_tsquery complex", () => {
      const cls = clause.WebsearchToTsQuery("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe(
        "name_idx @@ websearch_to_tsquery('simple', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "name_idx@@websearch_to_tsquery:simple:value",
      );
    });

    test("tsvectorcol_tsquery string", () => {
      const cls = clause.TsVectorColTsQuery("name_idx", "value");
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ to_tsquery('english', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@to_tsquery:english:value",
      );
    });

    test("tsvectorcol_tsquery complex", () => {
      const cls = clause.TsVectorColTsQuery("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ to_tsquery('simple', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@to_tsquery:simple:value",
      );
    });

    test("tsvectorcol_plainto_tsquery string", () => {
      const cls = clause.TsVectorPlainToTsQuery("name_idx", "value");
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ plainto_tsquery('english', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@plainto_tsquery:english:value",
      );
    });

    test("tsvectorcol_plainto_tsquery complex", () => {
      const cls = clause.TsVectorPlainToTsQuery("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ plainto_tsquery('simple', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@plainto_tsquery:simple:value",
      );
    });

    test("tsvectorcol__phraseto_tsquery string", () => {
      const cls = clause.TsVectorPhraseToTsQuery("name_idx", "value");
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ phraseto_tsquery('english', $1)",
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
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@phraseto_tsquery:simple:value",
      );
    });

    test("tsvectorcol_websearch_to_tsquery string", () => {
      const cls = clause.TsVectorWebsearchToTsQuery("name_idx", "value");
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ websearch_to_tsquery('english', $1)",
      );
      expect(cls.columns()).toStrictEqual(["name_idx"]);
      expect(cls.values()).toStrictEqual(["value"]);
      expect(cls.logValues()).toStrictEqual(["value"]);
      expect(cls.instanceKey()).toEqual(
        "to_tsvector(name_idx)@@websearch_to_tsquery:english:value",
      );
    });

    test("websearch_to_tsquery complex", () => {
      const cls = clause.TsVectorWebsearchToTsQuery("name_idx", {
        language: "simple",
        value: "value",
      });
      expect(cls.clause(1)).toBe(
        "to_tsvector(name_idx) @@ websearch_to_tsquery('simple', $1)",
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
      const cls = clause.PaginationMultipleColsSubQuery(
        "start_time",
        ">",
        "events",
        "id",
        "fooo",
      );
      expect(cls.clause(1)).toBe(
        "start_time > (SELECT start_time FROM events WHERE id = $1) OR (start_time = (SELECT start_time FROM events WHERE id = $2) AND id > $3)",
      );
      expect(cls.columns()).toStrictEqual(["start_time"]);
      expect(cls.values()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.logValues()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.instanceKey()).toEqual("start_time->-events-id-fooo");
    });

    test("> clause 3", () => {
      const cls = clause.PaginationMultipleColsSubQuery(
        "start_time",
        ">",
        "events",
        "id",
        "fooo",
      );
      expect(cls.clause(3)).toBe(
        "start_time > (SELECT start_time FROM events WHERE id = $3) OR (start_time = (SELECT start_time FROM events WHERE id = $4) AND id > $5)",
      );
      expect(cls.columns()).toStrictEqual(["start_time"]);
      expect(cls.values()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.logValues()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.instanceKey()).toEqual("start_time->-events-id-fooo");
    });

    test("<", () => {
      const cls = clause.PaginationMultipleColsSubQuery(
        "start_time",
        "<",
        "events",
        "id",
        "fooo",
      );
      expect(cls.clause(1)).toBe(
        "start_time < (SELECT start_time FROM events WHERE id = $1) OR (start_time = (SELECT start_time FROM events WHERE id = $2) AND id < $3)",
      );
      expect(cls.columns()).toStrictEqual(["start_time"]);
      expect(cls.values()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.logValues()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.instanceKey()).toEqual("start_time-<-events-id-fooo");
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
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id=4");
    });

    test("sensitive value", () => {
      const cls = clause.Eq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id = ?");
      expect(cls.clause(2)).toBe("id = ?");
      expect(cls.columns()).toStrictEqual(["id"]);
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
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id>4");
    });

    test("sensitive value", () => {
      const cls = clause.Greater("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id > ?");
      expect(cls.clause(2)).toBe("id > ?");
      expect(cls.columns()).toStrictEqual(["id"]);
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
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id<4");
    });

    test("sensitive value", () => {
      const cls = clause.Less("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id < ?");
      expect(cls.clause(2)).toBe("id < ?");
      expect(cls.columns()).toStrictEqual(["id"]);
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
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id>=4");
    });

    test("sensitive value", () => {
      const cls = clause.GreaterEq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id >= ?");
      expect(cls.clause(2)).toBe("id >= ?");
      expect(cls.columns()).toStrictEqual(["id"]);
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
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual([4]);
      expect(cls.instanceKey()).toEqual("id<=4");
    });

    test("sensitive value", () => {
      const cls = clause.LessEq("id", clause.sensitiveValue(4));
      expect(cls.clause(1)).toBe("id <= ?");
      expect(cls.clause(2)).toBe("id <= ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([4]);
      expect(cls.logValues()).toStrictEqual(["*"]);
      expect(cls.instanceKey()).toEqual("id<=4");
    });
  });

  describe("And", () => {
    test("2 items", () => {
      const cls = clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo"));
      expect(cls.clause(1)).toBe("id1 = ? AND id2 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "***"]);
      expect(cls.instanceKey()).toEqual("id1=iddd AND id2=foo AND id3=baz");
    });
  });

  describe("Or", () => {
    test("2 items", () => {
      const cls = clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo"));
      expect(cls.clause(1)).toBe("id1 = ? OR id2 = ?");
      expect(cls.columns()).toStrictEqual(["id1", "id2"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
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
      expect(cls.columns()).toStrictEqual(["id1", "id2", "id3"]);
      expect(cls.values()).toStrictEqual(["iddd", "foo", "baz"]);
      expect(cls.logValues()).toStrictEqual(["iddd", "foo", "***"]);
      expect(cls.instanceKey()).toEqual("id1=iddd OR id2=foo OR id3=baz");
    });
  });

  describe("nested and/or", () => {
    test("OR nested in AND", () => {
      const cls = clause.And(
        clause.Eq("id3", "bar"),
        clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
      );
      expect(cls.clause(1)).toBe("id3 = ? AND (id1 = ? OR id2 = ?)");
      expect(cls.columns()).toStrictEqual(["id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id3=bar AND (id1=iddd OR id2=foo)");
    });

    test("AND nested in Or", () => {
      const cls = clause.Or(
        clause.Eq("id3", "bar"),
        clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
      );
      expect(cls.clause(1)).toBe("id3 = ? OR (id1 = ? AND id2 = ?)");
      expect(cls.columns()).toStrictEqual(["id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toEqual("id3=bar OR (id1=iddd AND id2=foo)");
    });

    test("Or nested in AND nested in OR", () => {
      const cls = clause.Or(
        clause.Eq("id4", "baz"),
        clause.And(
          clause.Eq("id3", "bar"),
          clause.Or(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        ),
      );
      expect(cls.clause(1)).toBe(
        "id4 = ? OR (id3 = ? AND (id1 = ? OR id2 = ?))",
      );
      expect(cls.columns()).toStrictEqual(["id4", "id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toBe(
        "id4=baz OR (id3=bar AND (id1=iddd OR id2=foo))",
      );
    });

    test("And nested in OR nested in AND", () => {
      const cls = clause.And(
        clause.Eq("id4", "baz"),
        clause.Or(
          clause.Eq("id3", "bar"),
          clause.And(clause.Eq("id1", "iddd"), clause.Eq("id2", "foo")),
        ),
      );
      expect(cls.clause(1)).toBe(
        "id4 = ? AND (id3 = ? OR (id1 = ? AND id2 = ?))",
      );
      expect(cls.columns()).toStrictEqual(["id4", "id3", "id1", "id2"]);
      expect(cls.values()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.logValues()).toStrictEqual(["baz", "bar", "iddd", "foo"]);
      expect(cls.instanceKey()).toBe(
        "id4=baz AND (id3=bar OR (id1=iddd AND id2=foo))",
      );
    });

    test("complexx ", () => {
      const cls = clause.And(
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
      const cls = clause.In("id", 1);
      expect(cls.clause(1)).toBe("id = ?");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1]);
      expect(cls.logValues()).toStrictEqual([1]);
      expect(cls.instanceKey()).toEqual("in:id:1");
    });

    test("spread args", () => {
      const cls = clause.In("id", 1, 2, 3);
      expect(cls.clause(1)).toBe("id IN (?, ?, ?)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("spread args with sensitive value", () => {
      const cls = clause.In("id", 1, 2, clause.sensitiveValue(3));
      expect(cls.clause(1)).toBe("id IN (?, ?, ?)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, "*"]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("list", () => {
      const cls = clause.In("id", ...[1, 2, 3]);
      expect(cls.clause(1)).toBe("id IN (?, ?, ?)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, 2, 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });

    test("list with sensitive value", () => {
      const cls = clause.In("id", ...[1, clause.sensitiveValue(2), 3]);
      expect(cls.clause(1)).toBe("id IN (?, ?, ?)");
      expect(cls.columns()).toStrictEqual(["id"]);
      expect(cls.values()).toStrictEqual([1, 2, 3]);
      expect(cls.logValues()).toStrictEqual([1, "*", 3]);
      expect(cls.instanceKey()).toEqual("in:id:1,2,3");
    });
  });

  describe("pagination multiple cols query", () => {
    test(">", () => {
      const cls = clause.PaginationMultipleColsSubQuery(
        "start_time",
        ">",
        "events",
        "id",
        "fooo",
      );
      expect(cls.clause(1)).toBe(
        "start_time > (SELECT start_time FROM events WHERE id = ?) OR (start_time = (SELECT start_time FROM events WHERE id = ?) AND id > ?)",
      );
      expect(cls.columns()).toStrictEqual(["start_time"]);
      expect(cls.values()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.logValues()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.instanceKey()).toEqual("start_time->-events-id-fooo");
    });

    test("> clause 3", () => {
      const cls = clause.PaginationMultipleColsSubQuery(
        "start_time",
        ">",
        "events",
        "id",
        "fooo",
      );
      expect(cls.clause(3)).toBe(
        "start_time > (SELECT start_time FROM events WHERE id = ?) OR (start_time = (SELECT start_time FROM events WHERE id = ?) AND id > ?)",
      );
      expect(cls.columns()).toStrictEqual(["start_time"]);
      expect(cls.values()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.logValues()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.instanceKey()).toEqual("start_time->-events-id-fooo");
    });

    test("<", () => {
      const cls = clause.PaginationMultipleColsSubQuery(
        "start_time",
        "<",
        "events",
        "id",
        "fooo",
      );
      expect(cls.clause(1)).toBe(
        "start_time < (SELECT start_time FROM events WHERE id = ?) OR (start_time = (SELECT start_time FROM events WHERE id = ?) AND id < ?)",
      );
      expect(cls.columns()).toStrictEqual(["start_time"]);
      expect(cls.values()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.logValues()).toStrictEqual(["fooo", "fooo", "fooo"]);
      expect(cls.instanceKey()).toEqual("start_time-<-events-id-fooo");
    });
  });
});
