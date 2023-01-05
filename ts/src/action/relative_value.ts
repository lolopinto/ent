import { Data } from "src/core/base";
import {
  Add,
  Clause,
  Divide,
  Modulo,
  Multiply,
  Subtract,
} from "../core/clause";

export interface RelativeFieldValue<T = BigInt | number> {
  delta: T;
  sqlExpression: (col: string) => Clause;
  eval: (curr: T) => T;
}

export interface RelativeNumberValue<T> {
  add?: T;
  subtract?: T;
  divide?: T;
  multiply?: T;
  // note modulo only seems to work with integer types in postgres
  modulo?: T;
}

// and then that translates to calling these which returns a RelativeFieldValue which is much cleaner?
// can also do it one by one instead of what we had in

// https://github.com/microsoft/TypeScript/issues/27808 is why we have the ts-expect-error below
function addNumber(delta: number): RelativeFieldValue<number>;
function addNumber(delta: BigInt): RelativeFieldValue<BigInt>;
function addNumber<T = number | BigInt>(delta: T): RelativeFieldValue<T> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Add(col, delta);
    },
    eval(curr): T {
      // @ts-expect-error
      return curr + delta;
    },
  };
}

function subtractNumber(delta: number): RelativeFieldValue<number>;
function subtractNumber(delta: BigInt): RelativeFieldValue<BigInt>;
function subtractNumber<T = number | BigInt>(delta: T): RelativeFieldValue<T> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Subtract(col, delta);
    },
    eval(curr): T {
      // @ts-expect-error
      return curr - delta;
    },
  };
}

function multiplyNumber(delta: number): RelativeFieldValue<number>;
function multiplyNumber(delta: BigInt): RelativeFieldValue<BigInt>;
function multiplyNumber<T = number | BigInt>(delta: T): RelativeFieldValue<T> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Multiply(col, delta);
    },
    eval(curr): T {
      // @ts-expect-error
      return curr * delta;
    },
  };
}

function divideNumber(delta: number): RelativeFieldValue<number>;
function divideNumber(delta: BigInt): RelativeFieldValue<BigInt>;
function divideNumber<T = BigInt | number>(delta: T): RelativeFieldValue<T> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Divide(col, delta);
    },
    eval(curr): T {
      // @ts-expect-error
      return curr / delta;
    },
  };
}

// note modulo only seems to work with integer types in postgres
function moduloNumber(delta: number): RelativeFieldValue<number>;
function moduloNumber(delta: BigInt): RelativeFieldValue<BigInt>;
function moduloNumber<T = BigInt | number>(delta: T): RelativeFieldValue<T> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Modulo(col, delta);
    },
    eval(curr): T {
      // @ts-expect-error
      return curr % delta;
    },
  };
}

export const NumberOps = {
  addNumber,
  moduloNumber,
  divideNumber,
  subtractNumber,
  multiplyNumber,
};

export function convertRelativeInput(
  rel: RelativeNumberValue<BigInt>,
  col: string,
  existing: BigInt,
): { value: BigInt; clause: Clause };
export function convertRelativeInput(
  rel: RelativeNumberValue<number>,
  col: string,
  existing: number,
): { value: number; clause: Clause };
export function convertRelativeInput<T = BigInt | number>(
  rel: RelativeNumberValue<T>,
  col: string,
  existing: T,
): { value: T; clause: Clause } {
  if (Object.keys(rel).length !== 1) {
    throw new Error(`only 1 key is expected. ${Object.keys(rel).length} given`);
  }
  const ret = (relField: RelativeFieldValue<T>) => {
    return {
      value: relField.eval(existing),
      clause: relField.sqlExpression(col),
    };
  };
  if (rel.add !== undefined) {
    // @ts-expect-error
    return ret(addNumber(rel.add));
  }
  if (rel.subtract !== undefined) {
    // @ts-expect-error
    return ret(subtractNumber(rel.subtract));
  }
  if (rel.multiply !== undefined) {
    // @ts-expect-error
    return ret(multiplyNumber(rel.multiply));
  }
  if (rel.divide !== undefined) {
    // @ts-expect-error
    return ret(divideNumber(rel.divide));
  }
  if (rel.modulo !== undefined) {
    // @ts-expect-error
    return ret(moduloNumber(rel.modulo));
  }
  throw new Error(`error in convertRelativeInput. shouldn't have gotten here`);
}

export function maybeConvertRelativeInputPlusExpressions(
  rel: number | RelativeNumberValue<number>,
  col: string,
  existing: number,
  expressions: Map<string, Clause>,
): number;
export function maybeConvertRelativeInputPlusExpressions(
  rel: number | RelativeNumberValue<number> | undefined,
  col: string,
  existing: number,
  expressions: Map<string, Clause>,
): number | undefined;
export function maybeConvertRelativeInputPlusExpressions(
  rel: number | RelativeNumberValue<number> | null,
  col: string,
  existing: number | null,
  expressions: Map<string, Clause>,
): number | null;
export function maybeConvertRelativeInputPlusExpressions(
  rel: number | RelativeNumberValue<number> | null | undefined,
  col: string,
  existing: number | null,
  expressions: Map<string, Clause>,
): number | undefined | null;

export function maybeConvertRelativeInputPlusExpressions(
  rel: BigInt | RelativeNumberValue<BigInt>,
  col: string,
  existing: BigInt,
  expressions: Map<string, Clause>,
): BigInt;
export function maybeConvertRelativeInputPlusExpressions(
  rel: BigInt | RelativeNumberValue<BigInt> | undefined,
  col: string,
  existing: BigInt,
  expressions: Map<string, Clause>,
): BigInt | undefined;
export function maybeConvertRelativeInputPlusExpressions(
  rel: BigInt | RelativeNumberValue<BigInt> | null,
  col: string,
  existing: BigInt | null,
  expressions: Map<string, Clause>,
): BigInt | null;
export function maybeConvertRelativeInputPlusExpressions(
  rel: BigInt | RelativeNumberValue<BigInt> | null | undefined,
  col: string,
  existing: BigInt | null,
  expressions: Map<string, Clause>,
): BigInt | null | undefined;

export function maybeConvertRelativeInputPlusExpressions(
  rel:
    | number
    | RelativeNumberValue<number>
    | BigInt
    | RelativeNumberValue<BigInt>
    | null
    | undefined,
  col: string,
  existing: number | BigInt | null,
  expressions: Map<string, Clause>,
): number | null | undefined | BigInt {
  if (rel === null) {
    return rel;
  }
  if (rel === undefined) {
    return rel;
  }

  if (typeof rel === "bigint" || typeof rel === "number") {
    return rel;
  }

  // // TODO is this the behavior we want? should we coalesce as 0?
  // if (existing === null) {
  //   throw new Error(`cannot perform a relative operation on null`);
  // }
  // @ts-ignore
  // shouldn't be failing like it currently is. it thinks rel can be bigint  and it shouldn't be???
  const { clause, value } = convertRelativeInput(rel, col, existing);
  expressions.set(col, clause);
  return value;
}

const input: number | RelativeNumberValue<number> | undefined = undefined;
const existing = 3;
const expressions = new Map();

const ret = maybeConvertRelativeInputPlusExpressions(
  input,
  "credits",
  existing,
  expressions,
);
// TODO deletre....
// interface RelativeNumber {
//   [key: string]: BigInt | number | null | undefined;
// }

// interface RelativeNumberInput {
//   [key: string]: BigInt | number | null | undefined;
// }

// // I don't have the typescript foo to make this generic...
// // everything is generic but this only works for ids
// export function convertRelativeObj<T extends RelativeNumber>(
//   data: T,
//   input: T,
//   // fieldsWithRelativße: T2,
// ): { resolved: T; expressions: Map<string, Clause> } {
//   const ret: T = { ...input };
//   const expressions = new Map<string, Clause>();
//   for (const k in input) {
//     const v = input[k];
//     if (v === null || v === undefined || typeof v !== "object") {
//       continue;
//     }
//     const { clause, value } = convertRelativeInput(v, k, data[k]);
//     // replace value
//     // @ts-expect-error
//     ret[k] = value;
//     expressions.set(k, clause);
//   }

//   return { resolved: ret, expressions };
// }
