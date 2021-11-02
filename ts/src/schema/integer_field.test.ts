import { IntegerField, IntegerType, ListField } from "./field";

interface testCase {
  fn: () => IntegerField;
  valid: boolean;
  customInput?: number;
}

const input = 10;
const tests = new Map<string, testCase>([
  [
    "min property valid",
    {
      fn: () => IntegerType({ name: "field", min: 5 }),
      valid: true,
    },
  ],
  [
    "min property equal valid",
    {
      fn: () => IntegerType({ name: "field", min: 10 }),
      valid: true,
    },
  ],
  [
    "min property invalid",
    {
      fn: () => IntegerType({ name: "field", min: 50 }),
      valid: false,
    },
  ],
  [
    "min method valid",
    {
      fn: () => IntegerType({ name: "field" }).min(5),
      valid: true,
    },
  ],
  [
    "min method invalid",
    {
      fn: () => IntegerType({ name: "field" }).min(50),
      valid: false,
    },
  ],
  [
    "max property valid",
    {
      fn: () => IntegerType({ name: "field", max: 50 }),
      valid: true,
    },
  ],
  [
    "max property equal valid",
    {
      fn: () => IntegerType({ name: "field", max: 10 }),
      valid: true,
    },
  ],
  [
    "max property invalid",
    {
      fn: () => IntegerType({ name: "field", max: 5 }),
      valid: false,
    },
  ],
  [
    "max method valid",
    {
      fn: () => IntegerType({ name: "field" }).max(50),
      valid: true,
    },
  ],
  [
    "max method invalid",
    {
      fn: () => IntegerType({ name: "field" }).max(5),
      valid: false,
    },
  ],
]);

for (const [k, v] of tests) {
  test(k, () => {
    const f = v.fn();
    let val = v.customInput || input;
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
      expect(list.format([val])).toBe(`{${val}}`);
      expect(list.valid([val])).toBe(v.valid);
    });
  }
});
