import {
  ContextCache,
  getContextCacheMaxDiscardedLoaders,
  setContextCacheMaxDiscardedLoaders,
} from "./context";
import { Loader, QueryOptions } from "./base";
import * as clause from "./clause";

describe("ContextCache", () => {
  it("caps discarded loaders after repeated clearCache calls", () => {
    const previous = getContextCacheMaxDiscardedLoaders();

    try {
      setContextCacheMaxDiscardedLoaders(2);
      const cache = new ContextCache();
      const makeLoader = (): Loader<string, string> => ({
        load: async (key: string) => key,
        clearAll: jest.fn(),
      });

      for (let i = 0; i < 5; i++) {
        cache.getLoader(`loader:${i}`, makeLoader);
        cache.clearCache();
      }

      expect(cache.discardedLoaders.length).toBe(2);
    } finally {
      setContextCacheMaxDiscardedLoaders(previous);
    }
  });

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
