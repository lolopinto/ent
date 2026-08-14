import {
  BaseField,
  BigIntegerType,
  FloatType,
  IntegerField,
  IntegerType,
  ListField,
  NumberField,
  NumberOptions,
} from "./field.js";

interface testCase {
  fn: () => NumberField<any>;
  valid: boolean;
  customInput?: number;
}

interface NumberFieldConstructor<T> {
  new (options?: NumberOptions<T>): BaseField;
}
const input = 10;

const getTests = (func: (options?: NumberOptions<any>) => NumberField<any>) => {
  const tests = new Map<string, testCase>([
    [
      "min property valid",
      {
        fn: () => func({ min: 5 }),
        valid: true,
      },
    ],
    [
      "min property equal valid",
      {
        fn: () => func({ min: 10 }),
        valid: true,
      },
    ],
    [
      "min property invalid",
      {
        fn: () => func({ min: 50 }),
        valid: false,
      },
    ],
    [
      "min method valid",
      {
        fn: () => func().min(5),
        valid: true,
      },
    ],
    [
      "min method invalid",
      {
        fn: () => func().min(50),
        valid: false,
      },
    ],
    [
      "max property valid",
      {
        fn: () => func({ max: 50 }),
        valid: true,
      },
    ],
    [
      "max property equal valid",
      {
        fn: () => func({ max: 10 }),
        valid: true,
      },
    ],
    [
      "max property invalid",
      {
        fn: () => func({ max: 5 }),
        valid: false,
      },
    ],
    [
      "max method valid",
      {
        fn: () => func().max(50),
        valid: true,
      },
    ],
    [
      "max method invalid",
      {
        fn: () => func().max(5),
        valid: false,
      },
    ],
  ]);
  return tests;
};

function doTest(func: (options?: NumberOptions<any>) => NumberField<any>) {
  for (const [k, v] of getTests(func)) {
    test(k, () => {
      const f = v.fn();
      let val = v.customInput || input;
      expect(f.valid(val)).toBe(v.valid);
    });
  }

  describe("list", () => {
    for (const [k, v] of getTests(func)) {
      if (k.indexOf("property") === -1) {
        continue;
      }
      test(k, async () => {
        const f = v.fn();
        const list = new ListField(f, f.getOptions());
        let val = v.customInput || input;
        // list format for postgres list
        expect(list.format([val])).toBe(`{${val}}`);
        expect(await list.valid([val])).toBe(v.valid);
      });
    }
  });
}

describe("int", () => {
  doTest(IntegerType);
});

describe("float", () => {
  doTest(FloatType);
});

describe("bigint", () => {
  doTest(BigIntegerType);

  test("explicit bigint min property", () => {
    const f = BigIntegerType({ min: 10n });
    expect(f.valid(11n)).toBe(true);
  });

  test("explicit bigint min call", () => {
    const f = BigIntegerType().min(10n);
    expect(f.valid(11n)).toBe(true);
  });
});
