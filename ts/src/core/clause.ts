import DB, { Dialect } from "./db";

// NOTE: we use ? for sqlite dialect even though it supports $1 like postgres so that it'll be easier to support different dialects down the line

export interface Clause {
  clause(idx: number): string;
  values(): any[];
  instanceKey(): string;
  // values to log when querying
  logValues(): any[];
}

export interface SensitiveValue {
  value(): any;
  logValue(): any;
}

function isSensitive(val: any): val is SensitiveValue {
  return (
    typeof val === "object" && (val as SensitiveValue).logValue !== undefined
  );
}

function rawValue(val: any) {
  if (isSensitive(val)) {
    return val.value();
  }
  return val;
}

class simpleClause implements Clause {
  constructor(protected col: string, private value: any, private op: string) {}

  clause(idx: number): string {
    if (DB.getDialect() === Dialect.Postgres) {
      return `${this.col} ${this.op} $${idx}`;
    }
    return `${this.col} ${this.op} ?`;
  }

  values(): any[] {
    if (isSensitive(this.value)) {
      return [this.value.value()];
    }
    return [this.value];
  }

  logValues(): any[] {
    if (isSensitive(this.value)) {
      return [this.value.logValue()];
    }
    return [this.value];
  }

  instanceKey(): string {
    return `${this.col}${this.op}${rawValue(this.value)}`;
  }
}

class inClause implements Clause {
  constructor(private col: string, private value: any[]) {}

  clause(idx: number): string {
    const dialect = DB.getDialect();
    let indices: string[];
    if (dialect === Dialect.Postgres) {
      indices = [];
      for (let i = 0; i < this.value.length; i++) {
        indices.push(`$${idx}`);
        idx++;
      }
    } else {
      indices = new Array(this.value.length);
      indices.fill("?", 0);
    }

    const inValue = indices.join(", ");
    return `${this.col} IN (${inValue})`;
    // TODO we need to return idx at end to query builder...
    // or anything that's doing a composite query so next clause knows where to start
    // or change to a sqlx.Rebind format
    // here's what sqlx does: https://play.golang.org/p/vPzvYqeAcP0
  }

  values(): any[] {
    const result: any[] = [];
    for (const value of this.value) {
      if (isSensitive(value)) {
        result.push(value.value());
      } else {
        result.push(value);
      }
    }
    return result;
  }

  logValues(): any[] {
    const result: any[] = [];
    for (const value of this.value) {
      if (isSensitive(value)) {
        result.push(value.logValue());
      } else {
        result.push(value);
      }
    }
    return result;
  }

  instanceKey(): string {
    return `in:${this.col}:${this.values().join(",")}`;
  }
}

class compositeClause implements Clause {
  constructor(private clauses: Clause[], private sep: string) {}

  clause(idx: number): string {
    let clauses: string[] = [];
    for (const clause of this.clauses) {
      clauses.push(clause.clause(idx));
      idx = idx + clause.values().length;
    }
    return clauses.join(this.sep);
  }

  values(): any[] {
    let result = [];
    for (const clause of this.clauses) {
      result = result.concat(...clause.values());
    }
    return result;
  }

  logValues(): any[] {
    let result = [];
    for (const clause of this.clauses) {
      result = result.concat(...clause.logValues());
    }
    return result;
  }

  instanceKey(): string {
    let keys: string[] = [];
    this.clauses.forEach((clause) => keys.push(clause.instanceKey()));
    return keys.join(this.sep);
  }
}

export function Eq(col: string, value: any): simpleClause {
  return new simpleClause(col, value, "=");
}

export function NotEq(col: string, value: any): simpleClause {
  return new simpleClause(col, value, "!=");
}

export function Greater(col: string, value: any): simpleClause {
  return new simpleClause(col, value, ">");
}

export function Less(col: string, value: any): simpleClause {
  return new simpleClause(col, value, "<");
}

export function GreaterEq(col: string, value: any): simpleClause {
  return new simpleClause(col, value, ">=");
}

export function LessEq(col: string, value: any): simpleClause {
  return new simpleClause(col, value, "<=");
}

export function And(...args: Clause[]): compositeClause {
  return new compositeClause(args, " AND ");
}

export function Or(...args: Clause[]): compositeClause {
  return new compositeClause(args, " OR ");
}

// todo?
export function In(col: string, ...values: any): Clause {
  return new inClause(col, values);
}

// wrap a query in the db with this to ensure that it doesn't show up in the logs
// e.g. if querying for password, SSN, etc
// we'll pass the right fields to query and log something along the lines of `****`
export function sensitiveValue(val: any): SensitiveValue {
  return {
    value() {
      return val;
    },
    logValue() {
      return "*".repeat(`${val}`.length);
    },
  };
}
