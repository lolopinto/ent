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
    val !== null &&
    typeof val === "object" &&
    (val as SensitiveValue).logValue !== undefined
  );
}

function rawValue(val: any) {
  if (isSensitive(val)) {
    return val.value();
  }
  return val;
}

class simpleClause implements Clause {
  constructor(
    protected col: string,
    private value: any,
    private op: string,
    private handleSqliteNull?: Clause,
  ) {}

  clause(idx: number): string {
    const sqliteClause = this.sqliteNull();
    if (sqliteClause) {
      return sqliteClause.clause(idx);
    }
    if (DB.getDialect() === Dialect.Postgres) {
      return `${this.col} ${this.op} $${idx}`;
    }
    return `${this.col} ${this.op} ?`;
  }

  private sqliteNull() {
    if (!this.handleSqliteNull || this.value !== null) {
      return;
    }
    if (DB.getDialect() !== Dialect.SQLite) {
      return;
    }
    return this.handleSqliteNull;
  }

  values(): any[] {
    const sqliteClause = this.sqliteNull();
    if (sqliteClause) {
      return sqliteClause.values();
    }
    if (isSensitive(this.value)) {
      return [this.value.value()];
    }
    return [this.value];
  }

  logValues(): any[] {
    const sqliteClause = this.sqliteNull();
    if (sqliteClause) {
      return sqliteClause.logValues();
    }
    if (isSensitive(this.value)) {
      return [this.value.logValue()];
    }
    return [this.value];
  }

  instanceKey(): string {
    const sqliteClause = this.sqliteNull();
    if (sqliteClause) {
      return sqliteClause.instanceKey();
    }
    return `${this.col}${this.op}${rawValue(this.value)}`;
  }
}

class isNullClause implements Clause {
  constructor(protected col: string) {}

  clause(idx: number): string {
    return `${this.col} IS NULL`;
  }

  values(): any[] {
    return [];
  }

  logValues(): any[] {
    return [];
  }

  instanceKey(): string {
    return `${this.col} IS NULL`;
  }
}

class isNotNullClause implements Clause {
  constructor(protected col: string) {}

  clause(idx: number): string {
    return `${this.col} IS NOT NULL`;
  }

  values(): any[] {
    return [];
  }

  logValues(): any[] {
    return [];
  }

  instanceKey(): string {
    return `${this.col} IS NOT NULL`;
  }
}

class arraySimpleClause implements Clause {
  constructor(protected col: string, private value: any, private op: string) {}

  clause(idx: number): string {
    if (DB.getDialect() === Dialect.Postgres) {
      return `$${idx} ${this.op} ANY(${this.col})`;
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

class tsQueryClause implements Clause {
  constructor(protected col: string, protected val: string | TsQuery) {}

  private isTsQuery(val: string | TsQuery): val is TsQuery {
    return typeof val !== "string";
  }

  protected getInfo() {
    if (this.isTsQuery(this.val)) {
      return { value: this.val.value, language: this.val.language };
    }
    return {
      language: "english",
      value: this.val,
    };
  }
  clause(idx: number): string {
    const { language } = this.getInfo();
    if (Dialect.Postgres === DB.getDialect()) {
      return `${this.col} @@ ${this.getFunction()}('${language}', $${idx})`;
    }
    return `${this.col} @@ ${this.getFunction()}('${language}', ?)`;
  }

  values(): any[] {
    const { value } = this.getInfo();
    return [value];
  }

  logValues(): any[] {
    const { value } = this.getInfo();
    return [value];
  }

  protected getFunction(): string {
    return "to_tsquery";
  }

  instanceKey(): string {
    const { language, value } = this.getInfo();
    return `${this.col} @@${this.getFunction()}:${language}:${value}`;
  }
}

class plainToTsQueryClause extends tsQueryClause {
  protected getFunction(): string {
    return "plainto_tsquery";
  }
}

class phraseToTsQueryClause extends tsQueryClause {
  protected getFunction(): string {
    return "phraseto_tsquery";
  }
}

class websearchTosQueryClause extends tsQueryClause {
  protected getFunction(): string {
    return "websearch_to_tsquery";
  }
}

// TODO we need to check sqlite version...
export function ArrayEq(col: string, value: any): Clause {
  return new arraySimpleClause(col, value, "=");
}

export function ArrayNotEq(col: string, value: any): Clause {
  return new arraySimpleClause(col, value, "!=");
}

export function ArrayGreater(col: string, value: any): Clause {
  return new arraySimpleClause(col, value, ">");
}

export function ArrayLess(col: string, value: any): Clause {
  return new arraySimpleClause(col, value, "<");
}

export function ArrayGreaterEq(col: string, value: any): Clause {
  return new arraySimpleClause(col, value, ">=");
}

export function ArrayLessEq(col: string, value: any): Clause {
  return new arraySimpleClause(col, value, "<=");
}

export function Eq(col: string, value: any): Clause {
  return new simpleClause(col, value, "=", new isNullClause(col));
}

export function NotEq(col: string, value: any): Clause {
  return new simpleClause(col, value, "!=", new isNotNullClause(col));
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

export function AndOptional(...args: (Clause | undefined)[]): Clause {
  // @ts-ignore
  let filtered: Clause[] = args.filter((v) => v !== undefined);
  if (filtered.length === 1) {
    return filtered[0];
  }
  return And(...filtered);
}

export function Or(...args: Clause[]): compositeClause {
  return new compositeClause(args, " OR ");
}

// TODO this breaks if values.length ===1 and array. todo fix
export function In(col: string, ...values: any): Clause {
  return new inClause(col, values);
}

interface TsQuery {
  // todo lang ::reconfig
  language: "english" | "french" | "german" | "simple";
  value: string;
}

// if string defaults to english
// https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-PARSING-QUERIES
// to_tsquery
// plainto_tsquery
// phraseto_tsquery;
// websearch_to_tsquery
export function TsQuery(col: string, val: string | TsQuery): Clause {
  return new tsQueryClause(col, val);
}

export function PlainToTsQuery(col: string, val: string | TsQuery): Clause {
  return new plainToTsQueryClause(col, val);
}

export function PhraseToTsQuery(col: string, val: string | TsQuery): Clause {
  return new phraseToTsQueryClause(col, val);
}

export function WebsearchToTsQuery(col: string, val: string | TsQuery): Clause {
  return new websearchTosQueryClause(col, val);
}

// TODO would be nice to support this with building blocks but not supporting for now
// AND: foo & bar,
// OR: foo | bar
// followed by: foo <-> bar
// NOT: !foo
// starts_with: theo:*

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
