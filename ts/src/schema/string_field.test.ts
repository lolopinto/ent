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
      fn: () => StringType({ toLowerCase: true }),
      format: "hallo",
      valid: true,
    },
  ],
  [
    "tolowerCase method",
    {
      fn: () => StringType().toLowerCase(),
      format: "hallo",
      valid: true,
    },
  ],
  [
    "toUpperCase property",
    {
      fn: () => StringType({ toUpperCase: true }),
      format: "HALLO",
      valid: true,
    },
  ],
  [
    "toUpperCase method",
    {
      fn: () => StringType().toUpperCase(),
      format: "HALLO",
      valid: true,
    },
  ],
  [
    "minLen property valid",
    {
      fn: () => StringType({ minLen: 5 }),
      format: input,
      valid: true,
    },
  ],
  [
    "minLen property invalid",
    {
      fn: () => StringType({ minLen: 7 }),
      format: input,
      valid: false,
    },
  ],
  [
    "minLen method valid",
    {
      fn: () => StringType().minLen(5),
      format: input,
      valid: true,
    },
  ],
  [
    "minLen method invalid",
    {
      fn: () => StringType().minLen(7),
      format: input,
      valid: false,
    },
  ],
  [
    "maxLen property valid",
    {
      fn: () => StringType({ maxLen: 5 }),
      format: input,
      valid: true,
    },
  ],
  [
    "maxLen property invalid",
    {
      fn: () => StringType({ maxLen: 3 }),
      format: input,
      valid: false,
    },
  ],
  [
    "maxLen method valid",
    {
      fn: () => StringType().maxLen(5),
      format: input,
      valid: true,
    },
  ],
  [
    "maxLen method invalid",
    {
      fn: () => StringType().maxLen(3),
      format: input,
      valid: false,
    },
  ],
  [
    "length property valid",
    {
      fn: () => StringType({ length: 5 }),
      format: input,
      valid: true,
    },
  ],
  [
    "length property invalid",
    {
      fn: () => StringType({ length: 3 }),
      format: input,
      valid: false,
    },
  ],
  [
    "length method valid",
    {
      fn: () => StringType().length(5),
      format: input,
      valid: true,
    },
  ],
  [
    "length method invalid",
    {
      fn: () => StringType().length(3),
      format: input,
      valid: false,
    },
  ],
  [
    "match property valid",
    {
      fn: () => StringType({ match: /\w/ }),
      format: input,
      valid: true,
    },
  ],
  [
    "match property invalid",
    {
      fn: () => StringType({ match: /\d+/ }),
      format: input,
      valid: false,
    },
  ],
  [
    "match method valid",
    {
      fn: () => StringType().match(/\w/),
      format: input,
      valid: true,
    },
  ],
  [
    "match method invalid",
    {
      fn: () => StringType().match(/\d+/),
      format: input,
      valid: false,
    },
  ],
  [
    "doesNotMatch property valid",
    {
      fn: () => StringType({ doesNotMatch: /\d+/ }),
      format: input,
      valid: true,
    },
  ],
  [
    "doesNotMatch property invalid",
    {
      fn: () => StringType({ doesNotMatch: /\w/ }),
      format: input,
      valid: false,
    },
  ],
  [
    "doesNotMatch method valid",
    {
      fn: () => StringType().doesNotMatch(/\d+/),
      format: input,
      valid: true,
    },
  ],
  [
    "doesNotMatch method invalid",
    {
      fn: () => StringType().doesNotMatch(/\w/),
      format: input,
      valid: false,
    },
  ],
  [
    "trim property",
    {
      fn: () => StringType({ trim: true }),
      format: "hallo",
      valid: true,
      customInput: " hallo ",
    },
  ],
  [
    "trim method",
    {
      fn: () => StringType().trim(),
      format: "hallo",
      valid: true,
      customInput: " hallo ",
    },
  ],
  [
    "trimLeft property",
    {
      fn: () => StringType({ trimLeft: true }),
      format: "hallo",
      valid: true,
      customInput: " hallo",
    },
  ],
  [
    "trimLeft method",
    {
      fn: () => StringType().trimLeft(),
      format: "hallo",
      valid: true,
      customInput: " hallo",
    },
  ],
  [
    "trimRight property",
    {
      fn: () => StringType({ trimRight: true }),
      format: "hallo",
      valid: true,
      customInput: "hallo ",
    },
  ],
  [
    "trimRight method",
    {
      fn: () => StringType().trimRight(),
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
    test(k, async () => {
      const f = v.fn();
      const list = new ListField(f, f.getOptions());
      let val = v.customInput || input;
      // list format for postgres list
      expect(list.format([val])).toBe(`{${v.format}}`);
      expect(await list.valid([val])).toBe(v.valid);
    });
  }
});
