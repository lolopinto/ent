import { ListField, StringField, StringType } from "./field";

interface testCase {
  fn: () => StringField;
  format: string;
  valid: boolean;
  customInput?: string;
}

const input = "hAllO";
const tests = new Map<string, testCase>([
  [
    "toLowerCase property",
    {
      fn: () => StringType({ name: "field", toLowerCase: true }),
      format: "hallo",
      valid: true,
    },
  ],
  [
    "tolowerCase method",
    {
      fn: () => StringType({ name: "field" }).toLowerCase(),
      format: "hallo",
      valid: true,
    },
  ],
  [
    "toUpperCase property",
    {
      fn: () => StringType({ name: "field", toUpperCase: true }),
      format: "HALLO",
      valid: true,
    },
  ],
  [
    "toUpperCase method",
    {
      fn: () => StringType({ name: "field" }).toUpperCase(),
      format: "HALLO",
      valid: true,
    },
  ],
  [
    "minLen property valid",
    {
      fn: () => StringType({ name: "field", minLen: 5 }),
      format: input,
      valid: true,
    },
  ],
  [
    "minLen property invalid",
    {
      fn: () => StringType({ name: "field", minLen: 7 }),
      format: input,
      valid: false,
    },
  ],
  [
    "minLen method valid",
    {
      fn: () => StringType({ name: "field" }).minLen(5),
      format: input,
      valid: true,
    },
  ],
  [
    "minLen method invalid",
    {
      fn: () => StringType({ name: "field" }).minLen(7),
      format: input,
      valid: false,
    },
  ],
  [
    "maxLen property valid",
    {
      fn: () => StringType({ name: "field", maxLen: 5 }),
      format: input,
      valid: true,
    },
  ],
  [
    "maxLen property invalid",
    {
      fn: () => StringType({ name: "field", maxLen: 3 }),
      format: input,
      valid: false,
    },
  ],
  [
    "maxLen method valid",
    {
      fn: () => StringType({ name: "field" }).maxLen(5),
      format: input,
      valid: true,
    },
  ],
  [
    "maxLen method invalid",
    {
      fn: () => StringType({ name: "field" }).maxLen(3),
      format: input,
      valid: false,
    },
  ],
  [
    "length property valid",
    {
      fn: () => StringType({ name: "field", length: 5 }),
      format: input,
      valid: true,
    },
  ],
  [
    "length property invalid",
    {
      fn: () => StringType({ name: "field", length: 3 }),
      format: input,
      valid: false,
    },
  ],
  [
    "length method valid",
    {
      fn: () => StringType({ name: "field" }).length(5),
      format: input,
      valid: true,
    },
  ],
  [
    "length method invalid",
    {
      fn: () => StringType({ name: "field" }).length(3),
      format: input,
      valid: false,
    },
  ],
  [
    "match property valid",
    {
      fn: () => StringType({ name: "field", match: /\w/ }),
      format: input,
      valid: true,
    },
  ],
  [
    "match property invalid",
    {
      fn: () => StringType({ name: "field", match: /\d+/ }),
      format: input,
      valid: false,
    },
  ],
  [
    "match method valid",
    {
      fn: () => StringType({ name: "field" }).match(/\w/),
      format: input,
      valid: true,
    },
  ],
  [
    "match method invalid",
    {
      fn: () => StringType({ name: "field" }).match(/\d+/),
      format: input,
      valid: false,
    },
  ],
  [
    "doesNotMatch property valid",
    {
      fn: () => StringType({ name: "field", doesNotMatch: /\d+/ }),
      format: input,
      valid: true,
    },
  ],
  [
    "doesNotMatch property invalid",
    {
      fn: () => StringType({ name: "field", doesNotMatch: /\w/ }),
      format: input,
      valid: false,
    },
  ],
  [
    "doesNotMatch method valid",
    {
      fn: () => StringType({ name: "field" }).doesNotMatch(/\d+/),
      format: input,
      valid: true,
    },
  ],
  [
    "doesNotMatch method invalid",
    {
      fn: () => StringType({ name: "field" }).doesNotMatch(/\w/),
      format: input,
      valid: false,
    },
  ],
  [
    "trim property",
    {
      fn: () => StringType({ name: "field", trim: true }),
      format: "hallo",
      valid: true,
      customInput: " hallo ",
    },
  ],
  [
    "trim method",
    {
      fn: () => StringType({ name: "field" }).trim(),
      format: "hallo",
      valid: true,
      customInput: " hallo ",
    },
  ],
  [
    "trimLeft property",
    {
      fn: () => StringType({ name: "field", trimLeft: true }),
      format: "hallo",
      valid: true,
      customInput: " hallo",
    },
  ],
  [
    "trimLeft method",
    {
      fn: () => StringType({ name: "field" }).trimLeft(),
      format: "hallo",
      valid: true,
      customInput: " hallo",
    },
  ],
  [
    "trimRight property",
    {
      fn: () => StringType({ name: "field", trimRight: true }),
      format: "hallo",
      valid: true,
      customInput: "hallo ",
    },
  ],
  [
    "trimRight method",
    {
      fn: () => StringType({ name: "field" }).trimRight(),
      format: "hallo",
      valid: true,
      customInput: "hallo ",
    },
  ],
]);

for (const [k, v] of tests) {
  test(k, () => {
    const f = v.fn();
    let val = v.customInput || input;
    expect(f.format(val)).toBe(v.format);
    expect(f.valid(val)).toBe(v.valid);
  });
}

describe("list", () => {
  for (const [k, v] of tests) {
    if (k.indexOf("property") === -1) {
      continue;
    }
    test(k, () => {
      const f = v.fn();
      const list = new ListField(f, f.getOptions());
      let val = v.customInput || input;
      // list format for postgres list
      expect(list.format([val])).toBe(`{${v.format}}`);
      expect(list.valid([val])).toBe(v.valid);
    });
  }
});
