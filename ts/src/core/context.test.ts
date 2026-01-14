import { ContextCache } from "./context";
import { QueryOptions } from "./base";
import * as clause from "./clause";

describe("ContextCache", () => {
  test("query cache keys include limit/offset/orderby/join", () => {
    const cache = new ContextCache();
    const baseOptions: QueryOptions = {
      tableName: "users",
      fields: ["id", "name"],
      clause: clause.Eq("id", 1),
      distinct: false,
      alias: "u",
      fieldsAlias: "u",
      disableFieldsAlias: false,
      disableDefaultOrderByAlias: false,
      groupby: "id",
      orderby: [{ column: "id", direction: "ASC" }],
      join: [
        {
          tableName: "teams",
          alias: "t",
          clause: clause.Eq("team_id", 1, "t"),
          type: "left",
        },
      ],
      limit: 10,
      offset: 5,
    };
    const rows = [{ id: 1, name: "A" }];

    cache.primeCache(baseOptions, rows);

    expect(cache.getCachedRows({ ...baseOptions })).toBe(rows);

    expect(cache.getCachedRows({ ...baseOptions, limit: 11 })).toBeNull();
    expect(cache.getCachedRows({ ...baseOptions, offset: 6 })).toBeNull();
    expect(
      cache.getCachedRows({
        ...baseOptions,
        orderby: [{ column: "id", direction: "DESC" }],
      }),
    ).toBeNull();
    expect(
      cache.getCachedRows({
        ...baseOptions,
        join: [
          {
            tableName: "teams",
            alias: "t",
            clause: clause.Eq("team_id", 2, "t"),
            type: "left",
          },
        ],
      }),
    ).toBeNull();
  });
});
