// TODO tests and update functionality to match golang
function splitWords(input: string): string[] {
  if (!input) {
    return [];
  }

  const parts = input.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const words: string[] = [];

  for (const part of parts) {
    const split = _splitCamelCase(part);
    for (const piece of split) {
      if (!piece.s) {
        continue;
      }
      if (piece.type === "digit" && words.length > 0) {
        words[words.length - 1] += piece.s;
      } else {
        words.push(piece.s);
      }
    }
  }

  return words;
}

function upperFirst(input: string): string {
  if (!input) {
    return "";
  }
  return input[0].toUpperCase() + input.slice(1);
}

function camelCase(input: string): string {
  const words = splitWords(input);
  if (words.length === 0) {
    return "";
  }
  const [first, ...rest] = words;
  return (
    first.toLowerCase() +
    rest.map((word) => upperFirst(word.toLowerCase())).join("")
  );
}

function pascalCase(input: string): string {
  return splitWords(input)
    .map((word) => upperFirst(word.toLowerCase()))
    .join("");
}

function snakeCase(input: string): string {
  return splitWords(input)
    .map((word) => word.toLowerCase())
    .join("_");
}

export function toDBColumnOrTable(...strs: string[]): string {
  let name = "";
  for (let i = 0; i < strs.length; i++) {
    const s = strs[i];

    // this is to handle userIDs -> user_ids
    const split = _splitCamelCase(s);
    if (split.length > 2) {
      const last = split[split.length - 1];
      const nextLast = split[split.length - 2];
      if (last.s === "s" && nextLast.type === "upper") {
        // get the first n-2 words
        name += snakeCase(
          split
            .map((v) => v.s)
            .slice(0, split.length - 2)
            .join(""),
        );
        name += "_";

        // combine the last two
        name += snakeCase(nextLast.s);
        name += last.s;
        continue;
      }
    }
    name += snakeCase(s);
    if (i !== strs.length - 1) {
      name += "_";
    }
  }
  return name;
}

export function toFilePath(s: string): string {
  return snakeCase(s);
}

export function toFieldName(...strs: string[]): string {
  let name = "";
  let hasDoneLower = false;

  for (const s of strs) {
    // same logic in toDBColumnOrTable
    const split = _splitCamelCase(s);
    if (split.length > 2) {
      const last = split[split.length - 1];
      const nextLast = split[split.length - 2];
      if (last.s === "s" && nextLast.type === "upper") {
        // get the first n-2 words
        name += camelCase(
          split
            .map((v) => v.s)
            .slice(0, split.length - 2)
            .join(""),
        );

        // combine the last two
        name += pascalCase(nextLast.s);
        name += last.s;
        hasDoneLower = true;
        continue;
      }
    }
    if (!hasDoneLower) {
      name += camelCase(s);
      hasDoneLower = true;
    } else {
      name += pascalCase(s);
    }
  }
  return name;
}

export function toClassName(str: string): string {
  return pascalCase(str);
}

interface splitResult {
  s: string;
  type: "lower" | "upper" | "digit" | "other";
}

function isUpper(s: string): boolean {
  for (const c of s) {
    if (!(c >= "A" && c <= "Z")) {
      return false;
    }
  }
  return true;
}

function isLower(s: string): boolean {
  for (const c of s) {
    if (!(c >= "a" && c <= "z")) {
      return false;
    }
  }
  return true;
}

function isDigit(s: string): boolean {
  return /^\d+$/.test(s);
}

// ported from golang in internal/names/names.go
export function _splitCamelCase(s: string): splitResult[] {
  const results: splitResult[] = [];

  let lastType: splitResult["type"] | undefined;
  let type: splitResult["type"] | undefined;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (isLower(c)) {
      type = "lower";
    } else if (isUpper(c)) {
      type = "upper";
    } else if (isDigit(c)) {
      type = "digit";
    } else {
      type = "other";
    }

    if (lastType == type) {
      results[results.length - 1].s += c;
    } else {
      results.push({ s: c, type });
    }
    lastType = type;
  }

  // this is for handling the userIDs -> "user", "ID", "s" case
  const isPlural = function (curr: string, next: string): boolean {
    return curr.length > 1 && next === "s";
  };

  for (let i = 0; i < results.length - 1; i++) {
    if (
      isUpper(results[i].s[0]) &&
      isLower(results[i + 1].s[0]) &&
      !isPlural(results[i].s, results[i + 1].s)
    ) {
      // get last item from results[i] and add to front of results[i+1]
      results[i + 1].s =
        results[i].s[results[i].s.length - 1] + results[i + 1].s;
      // now has a prefix and is not all of one case
      results[i + 1].type = "other";
      // remove last character from results[i]
      results[i].s = results[i].s.slice(0, results[i].s.length - 1);
    } else if (isDigit(results[i].s[0]) && isLower(results[i + 1].s[0])) {
      results[i].s = results[i].s + results[i + 1].s;
      results[i].type = "other";

      // remove
      results[i + 1].s = "";
      i++;
    }
  }
  for (let i = 0; i < results.length; i++) {
    if (results[i].s === "") {
      results.splice(i, 1);
      i--;
    }
  }
  return results;
}
