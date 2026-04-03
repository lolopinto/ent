export function memoizeNoArgs<T>(fn: () => T): () => T {
  let called = false;
  let value: T;

  return () => {
    if (called) {
      return value;
    }
    value = fn();
    called = true;
    return value;
  };
}
