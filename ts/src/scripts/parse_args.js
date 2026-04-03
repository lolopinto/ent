"use strict";

function coerceValue(value) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}

function normalizeKey(key) {
  return key.replace(/-/g, "_");
}

function setOption(result, key, value) {
  result[key] = value;
  const normalized = normalizeKey(key);
  if (normalized !== key) {
    result[normalized] = value;
  }
}

function parseArgs(argv) {
  const result = { _: [] };
  const args = argv || process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--") {
      result._.push(...args.slice(i + 1));
      break;
    }

    if (!arg.startsWith("-") || arg === "-") {
      result._.push(arg);
      continue;
    }

    if (arg.startsWith("--no-")) {
      setOption(result, normalizeKey(arg.slice(5)), false);
      continue;
    }

    if (arg.startsWith("--")) {
      const body = arg.slice(2);
      const idx = body.indexOf("=");
      if (idx !== -1) {
        setOption(
          result,
          normalizeKey(body.slice(0, idx)),
          coerceValue(body.slice(idx + 1)),
        );
        continue;
      }

      const key = normalizeKey(body);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        setOption(result, key, coerceValue(next));
        i++;
      } else {
        setOption(result, key, true);
      }
      continue;
    }

    const shorts = arg.slice(1);
    if (shorts.length === 1) {
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        setOption(result, shorts, coerceValue(next));
        i++;
      } else {
        setOption(result, shorts, true);
      }
      continue;
    }

    for (const ch of shorts) {
      setOption(result, ch, true);
    }
  }

  return result;
}

module.exports = { parseArgs };
