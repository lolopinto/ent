import { isPromise } from "util/types";
import {
  assertTransactionRead,
  getTransactionReadState,
} from "./transaction_context";

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

// Cached query/loader state cannot cross scopes. Ordinary builder field
// memoization remains readable by post-commit observers and result callers.
export function memoizeInTransaction<T>(fn: () => T): () => T {
  const transaction = getTransactionReadState();
  const memoized = memoizeNoArgs(fn);
  return () => {
    assertTransactionRead(transaction);
    const result = memoized();
    if (transaction && isPromise(result)) {
      return result.then((value) => {
        assertTransactionRead(transaction);
        return value;
      }) as T;
    }
    return result;
  };
}
