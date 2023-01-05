import {
  Add,
  Clause,
  Divide,
  Modulo,
  Multiply,
  Subtract,
} from "../core/clause";

export interface RelativeFieldValue<T extends any> {
  delta: T;
  sqlExpression: (col: string) => Clause;
  eval: (curr: T) => T;
}

export interface RelativeNumberValue {
  add?: number;
  subtract?: number;
  divide?: number;
  multiply?: number;
  // note modulo only seems to work with integer types in postgres
  modulo?: number;
}

// and then that translates to calling these which returns a RelativeFieldValue which is much cleaner?
// can also do it one by one instead of what we had in

// https://github.com/microsoft/TypeScript/issues/27808 is why operator overloading is happening
function addNumber(delta: number): RelativeFieldValue<number>;
function addNumber(delta: BigInt): RelativeFieldValue<BigInt>;
function addNumber(
  delta: number | BigInt,
): RelativeFieldValue<number | BigInt> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Add(col, delta);
    },
    eval(curr) {
      // @ts-expect-error
      return curr + delta;
    },
  };
}

function subtractNumber(delta: number): RelativeFieldValue<number>;
function subtractNumber(delta: number): RelativeFieldValue<number>;
function subtractNumber(
  delta: number | BigInt,
): RelativeFieldValue<number | BigInt> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Subtract(col, delta);
    },
    eval(curr) {
      // @ts-expect-error
      return curr - delta;
    },
  };
}

function multiplyNumber(delta: BigInt): RelativeFieldValue<BigInt>;
function multiplyNumber(delta: number): RelativeFieldValue<number>;
function multiplyNumber(
  delta: number | BigInt,
): RelativeFieldValue<number | BigInt> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Multiply(col, delta);
    },
    eval(curr) {
      // @ts-expect-error
      return curr * delta;
    },
  };
}

function divideNumber(delta: BigInt): RelativeFieldValue<BigInt>;
function divideNumber(delta: number): RelativeFieldValue<number>;
function divideNumber(
  delta: number | BigInt,
): RelativeFieldValue<number | BigInt> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Divide(col, delta);
    },
    eval(curr) {
      // @ts-expect-error
      return curr / delta;
    },
  };
}

// note modulo only seems to work with integer types in postgres
function moduloNumber(delta: BigInt): RelativeFieldValue<BigInt>;
function moduloNumber(delta: number): RelativeFieldValue<number>;
function moduloNumber(
  delta: number | BigInt,
): RelativeFieldValue<number | BigInt> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Modulo(col, delta);
    },
    eval(curr) {
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
