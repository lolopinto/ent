/// <reference lib="es2023.collection" />
import { createHmac, randomBytes } from "crypto";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForStableStringify(item));
  }

  if (isPlainObject(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = normalizeForStableStringify(value[key]);
    }
    return sorted;
  }

  return value;
}

export function stableStringify(value: unknown): string {
  const normalized = normalizeForStableStringify(value);
  const result = JSON.stringify(normalized);
  return result === undefined ? "undefined" : result;
}

// Diagnostic identities stay stable within a process without exposing cache data.
// A random HMAC key prevents guessing low-entropy secrets from logged digests.
const diagnosticKey = randomBytes(32);
const diagnosticReferences = new WeakMap<object | symbol, string>();
let nextDiagnosticReference = 0n;
export function cacheDiagnosticKey(value: unknown): string {
  if (
    (typeof value === "object" && value !== null) ||
    typeof value === "function" ||
    (typeof value === "symbol" && Symbol.keyFor(value) === undefined)
  ) {
    // Reference keys include non-registered symbols (supported since Node 20).
    // Do not serialize objects, inspect symbol descriptions or call user code.
    let identity = diagnosticReferences.get(value);
    if (!identity) {
      identity = `ref:${++nextDiagnosticReference}`;
      diagnosticReferences.set(value, identity);
    }
    return identity;
  }
  return createHmac("sha256", diagnosticKey)
    .update(`${typeof value}:${String(value)}`)
    .digest("hex");
}
