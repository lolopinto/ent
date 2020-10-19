export interface Clause {
  clause(idx: number): string;
  values(): any[];
  instanceKey(): string;
}

class simpleClause implements Clause {
  constructor(private col: string, private value: any, private op: string) {}

  clause(idx: number): string {
    return `${this.col} ${this.op} $${idx}`;
  }

  values(): any[] {
    return [this.value];
  }

  instanceKey(): string {
    return `${this.col}${this.op}${this.value}`;
  }
}

class inClause implements Clause {
  constructor(private col: string, private value: any[]) {}

  clause(idx: number): string {
    let indices: string[] = [];
    for (let i = 0; i < this.value.length; i++) {
      indices.push(`$${idx}`);
      idx++;
    }
    const inValue = indices.join(", ");
    return `${this.col} IN (${inValue})`;
    // TODO we need to return idx at end to query builder...
    // or anything that's doing a composite query so next clause knows where to start
    // or change to a sqlx.Rebind format
    // here's what sqlx does: https://play.golang.org/p/vPzvYqeAcP0
  }

  values(): any[] {
    return this.value;
  }

  instanceKey(): string {
    return `in:${this.col}:${this.value.join(",")}`;
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

  instanceKey(): string {
    let keys: string[] = [];
    this.clauses.forEach((clause) => keys.push(clause.instanceKey()));
    return keys.join(this.sep);
  }
}

export function Eq(col: string, value: any): simpleClause {
  return new simpleClause(col, value, "=");
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
