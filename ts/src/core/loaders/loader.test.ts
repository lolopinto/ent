import { BoundedCacheMap } from "./loader";

describe("BoundedCacheMap", () => {
  it("evicts the oldest entry when max size is exceeded", () => {
    const baseMap = new Map<string, number>();
    const cacheMap = new BoundedCacheMap(baseMap, 2);

    cacheMap.set("a", 1);
    cacheMap.set("b", 2);
    cacheMap.set("c", 3);

    expect(baseMap.size).toBe(2);
    expect(cacheMap.get("a")).toBeUndefined();
    expect(cacheMap.get("b")).toBe(2);
    expect(cacheMap.get("c")).toBe(3);
  });
});
