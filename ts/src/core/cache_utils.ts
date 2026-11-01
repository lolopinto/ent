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

// Diagnostic identities are process-local. Objects, functions and unregistered
// symbols use reference identity, so equal contents do not imply equal IDs.
// Other primitive keys, including registered symbols, use a random HMAC key
// to prevent guessing low-entropy secrets from logged digests.
const diagnosticKey = randomBytes(32);
const diagnosticReferences = new WeakMap<object | symbol, string>();
let nextDiagnosticReference = 0n;
export function cacheDiagnosticKey(value: unknown): string {
  if (
    (typeof value === "object" && value !== null) ||
    typeof value === "function" ||
    (typeof value === "symbol" && Symbol.keyFor(value) === undefined)
  ) {
    // This reference-only branch does not serialize objects, inspect unregistered
    // symbol descriptions or call user code.
    let identity = diagnosticReferences.get(value);
    if (!identity) {
      identity = `ref:${++nextDiagnosticReference}`;
      diagnosticReferences.set(value, identity);
    }
    return identity;
  }
  // Registered symbols are hashed from their string representation, including
  // the registry key; the text is not emitted.
  return createHmac("sha256", diagnosticKey)
    .update(`${typeof value}:${String(value)}`)
    .digest("hex");
}
