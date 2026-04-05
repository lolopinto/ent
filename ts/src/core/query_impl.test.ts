import * as clause from "./clause";
import { buildQueryData, getOrderByKey } from "./query_impl";

function distanceExpression(key: string) {
  return clause.ParameterizedExpression(
    key,
    (idx, alias) =>
      `distance(${alias ? `${alias}.location` : "location"}, $${idx}, $${idx + 1})`,
    [12.3, 45.6],
  );
}

describe("query_impl computed expressions", () => {
  test("buildQueryData includes computed select and order expressions", () => {
    const queryData = buildQueryData({
      tableName: "places",
      alias: "p",
      fields: ["id", { alias: "distance", expression: distanceExpression("d") }],
      clause: clause.Eq("active", true),
      orderby: [
        {
          column: "distance",
          direction: "ASC",
          expression: distanceExpression("d"),
        },
      ],
      limit: 5,
    });

    expect(queryData.query).toBe(
      "SELECT p.id, distance(p.location, $1, $2) AS distance FROM places AS p WHERE p.active = $3 ORDER BY distance(p.location, $4, $5) ASC LIMIT 5",
    );
    expect(queryData.values).toEqual([12.3, 45.6, true, 12.3, 45.6]);
    expect(queryData.logValues).toEqual([12.3, 45.6, true, 12.3, 45.6]);
  });

  test("order by keys use expression instance keys", () => {
    expect(
      getOrderByKey([
        {
          column: "distance",
          direction: "ASC",
          expression: distanceExpression("same"),
        },
      ]),
    ).toBe(
      getOrderByKey([
        {
          column: "distance",
          direction: "ASC",
          expression: distanceExpression("same"),
        },
      ]),
    );

    expect(
      getOrderByKey([
        {
          column: "distance",
          direction: "ASC",
          expression: distanceExpression("same"),
        },
      ]),
    ).not.toBe(
      getOrderByKey([
        {
          column: "distance",
          direction: "ASC",
          expression: distanceExpression("different"),
        },
      ]),
    );
  });
});
