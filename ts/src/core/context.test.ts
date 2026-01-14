import {
  ContextCache,
  getContextCacheMaxDiscardedLoaders,
  setContextCacheMaxDiscardedLoaders,
} from "./context";
import { Loader } from "./base";

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
});
