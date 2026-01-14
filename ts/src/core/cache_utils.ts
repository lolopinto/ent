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
