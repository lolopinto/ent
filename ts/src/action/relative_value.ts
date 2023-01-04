// this should all be in action somewhere...
// TODO remove this from here and move away from action

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

// this is the public API instead...
interface RelativeNumberOps {
  add?: number;
  subtract?: number;
  divide?: number;
  multiply?: number;
  // note modulo only seems to work with integer types in postgres
  modulo?: number;
}

// and then that translates to calling these which returns a RelativeFieldValue which is much cleaner?
// can also do it one by one instead of what we had in

function addNumber(delta: number): RelativeFieldValue<number> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Add(col, delta);
    },
    eval(curr) {
      return curr + delta;
    },
  };
}

function subtractNumber(delta: number): RelativeFieldValue<number> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Subtract(col, delta);
    },
    eval(curr) {
      return curr - delta;
    },
  };
}

function multiplyNumber(delta: number): RelativeFieldValue<number> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Multiply(col, delta);
    },
    eval(curr) {
      return curr * delta;
    },
  };
}

function divideNumber(delta: number): RelativeFieldValue<number> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Divide(col, delta);
    },
    eval(curr) {
      return curr / delta;
    },
  };
}

// note modulo only seems to work with integer types in postgres
function moduloNumber(delta: number): RelativeFieldValue<number> {
  return {
    delta,
    sqlExpression(col: string): Clause {
      return Modulo(col, delta);
    },
    eval(curr) {
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
