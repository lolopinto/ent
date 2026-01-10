import { mapWithConcurrency } from "./async_utils";

describe("mapWithConcurrency", () => {
  const delays = [30, 10, 25, 5, 20];

  async function runWithLimit(limit: number) {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = [1, 2, 3, 4, 5];

    const results = await mapWithConcurrency(items, limit, async (item, idx) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, delays[idx]));
      inFlight -= 1;
      return item * 2;
    });

    return { maxInFlight, results };
  }

  test("runs sequentially with limit 1", async () => {
    const { maxInFlight, results } = await runWithLimit(1);
    expect(maxInFlight).toBe(1);
    expect(results).toStrictEqual([2, 4, 6, 8, 10]);
  });

  test("runs concurrently with limit 2", async () => {
    const { maxInFlight, results } = await runWithLimit(2);
    expect(maxInFlight).toBe(2);
    expect(results).toStrictEqual([2, 4, 6, 8, 10]);
  });
});
