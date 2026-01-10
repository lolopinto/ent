export async function mapWithConcurrency<T, U>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  if (!items.length) {
    return [];
  }

  const results = new Array<U>(items.length);
  const concurrency =
    limit === Infinity
      ? items.length
      : Number.isFinite(limit) && limit > 0
        ? Math.max(1, Math.floor(limit))
        : 1;
  let nextIndex = 0;

  const workers = new Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(async () => {
      while (true) {
        const currentIndex = nextIndex;
        if (currentIndex >= items.length) {
          return;
        }
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    });

  await Promise.all(workers);
  return results;
}
