import DB, { Dialect } from "./db";

// NOTE: we use ? for sqlite dialect even though it supports $1 like postgres so that it'll be easier to support different dialects down the line

export interface Clause {
  clause(idx: number): string;
  columns(): string[];
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
    private handleNull?: Clause,
  ) {}

  clause(idx: number): string {
    const nullClause = this.nullClause();
    if (nullClause) {
      return nullClause.clause(idx);
    }
    if (DB.getDialect() === Dialect.Postgres) {
      return `${this.col} ${this.op} $${idx}`;
    }
    return `${this.col} ${this.op} ?`;
  }

  private nullClause() {
    if (!this.handleNull || this.value !== null) {
      return;
    }
    return this.handleNull;
  }

  columns(): string[] {
    return [this.col];
  }

  values(): any[] {
    const sqliteClause = this.nullClause();
    if (sqliteClause) {
      return sqliteClause.values();
    }
    if (isSensitive(this.value)) {
      return [this.value.value()];
    }
    return [this.value];
  }

  logValues(): any[] {
    const sqliteClause = this.nullClause();
    if (sqliteClause) {
      return sqliteClause.logValues();
    }
    if (isSensitive(this.value)) {
      return [this.value.logValue()];
    }
    return [this.value];
  }

  instanceKey(): string {
    const sqliteClause = this.nullClause();
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

  columns(): string[] {
    return [];
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

  columns(): string[] {
    return [];
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

  columns(): string[] {
    return [this.col];
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

class postgresArrayOperator implements Clause {
  constructor(
    protected col: string,
    protected value: any,
    private op: string,
    private not?: boolean,
  ) {}

  clause(idx: number): string {
    if (DB.getDialect() === Dialect.Postgres) {
      if (this.not) {
        return `NOT ${this.col} ${this.op} $${idx}`;
      }
      return `${this.col} ${this.op} $${idx}`;
    }
    throw new Error(`not supported`);
  }

  columns(): string[] {
    return [this.col];
  }

  values(): any[] {
    if (isSensitive(this.value)) {
      return [`{${this.value.value()}}`];
    }
    return [`{${this.value}}`];
  }

  logValues(): any[] {
    if (isSensitive(this.value)) {
      return [this.value.logValue()];
    }
    return [this.value];
  }

  instanceKey(): string {
    if (this.not) {
      return `NOT:${this.col}${this.op}${rawValue(this.value)}`;
    }
    return `${this.col}${this.op}${rawValue(this.value)}`;
  }
}

class postgresArrayOperatorList extends postgresArrayOperator {
  constructor(col: string, value: any[], op: string, not?: boolean) {
    super(col, value, op, not);
  }

  values(): any[] {
    return [
      `{${this.value
        .map((v: any) => {
          if (isSensitive(v)) {
            return v.value();
          }
          return v;
        })
        .join(", ")}}`,
    ];
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

  columns(): string[] {
    return [this.col];
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

  columns(): string[] {
    const ret: string[] = [];
    for (const cls of this.clauses) {
      ret.push(...cls.columns());
    }
    return ret;
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
  constructor(
    protected col: string,
    protected val: string | TsQuery,
    private tsVectorCol?: boolean,
  ) {}

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
      if (this.tsVectorCol) {
        return `to_tsvector(${
          this.col
        }) @@ ${this.getFunction()}('${language}', $${idx})`;
      }
      return `${this.col} @@ ${this.getFunction()}('${language}', $${idx})`;
    }
    // FYI this doesn't actually work for sqlite since different
    return `${this.col} @@ ${this.getFunction()}('${language}', ?)`;
  }

  columns(): string[] {
    return [this.col];
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
    if (this.tsVectorCol) {
      return `to_tsvector(${
        this.col
      })@@${this.getFunction()}:${language}:${value}`;
    }
    return `${this.col}@@${this.getFunction()}:${language}:${value}`;
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

// postgres array operators
// https://www.postgresql.org/docs/current/functions-array.html

/**
 * creates a clause to determine if the given value is contained in the array stored in the column in the db
 * only works with postgres gin indexes
 * https://www.postgresql.org/docs/current/indexes-types.html#INDEXES-TYPES-GIN
 */
export function PostgresArrayContainsValue(col: string, value: any): Clause {
  return new postgresArrayOperator(col, value, "@>");
}

/**
 * creates a clause to determine if every item in the list is stored in the array stored in the column in the db
 * only works with postgres gin indexes
 * https://www.postgresql.org/docs/current/indexes-types.html#INDEXES-TYPES-GIN
 */
export function PostgresArrayContains(col: string, value: any[]): Clause {
  return new postgresArrayOperatorList(col, value, "@>");
}

/**
 * creates a clause to determine if the given value is NOT contained in the array stored in the column in the db
 * only works with postgres gin indexes
 * https://www.postgresql.org/docs/current/indexes-types.html#INDEXES-TYPES-GIN
 */
export function PostgresArrayNotContainsValue(col: string, value: any): Clause {
  return new postgresArrayOperator(col, value, "@>", true);
}

/**
 * creates a clause to determine if every item in the list is NOT stored in the array stored in the column in the db
 * only works with postgres gin indexes
 * https://www.postgresql.org/docs/current/indexes-types.html#INDEXES-TYPES-GIN
 */
export function PostgresArrayNotContains(col: string, value: any[]): Clause {
  return new postgresArrayOperatorList(col, value, "@>", true);
}

/**
 * creates a clause to determine if the arrays overlap, that is, do they have any elements in common
 * only works with postgres gin indexes
 * https://www.postgresql.org/docs/current/indexes-types.html#INDEXES-TYPES-GIN
 */
export function PostgresArrayOverlaps(col: string, value: any[]): Clause {
  return new postgresArrayOperatorList(col, value, "&&");
}

/**
 * creates a clause to determine if the arrays do not overlap, that is, do they have any elements in common
 * only works with postgres gin indexes
 * https://www.postgresql.org/docs/current/indexes-types.html#INDEXES-TYPES-GIN
 */
export function PostgresArrayNotOverlaps(col: string, value: any[]): Clause {
  return new postgresArrayOperatorList(col, value, "&&", true);
}

/**
 * @deprecated use PostgresArrayContainsValue
 */
export function ArrayEq(col: string, value: any): Clause {
  return new arraySimpleClause(col, value, "=");
}

/**
 * @deprecated use PostgresNotArrayContains
 */
export function ArrayNotEq(col: string, value: any): Clause {
  return new arraySimpleClause(col, value, "!=");
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

// TsVectorColTsQuery is used when the column is not a tsvector field e.g.
// when there's an index just on the field and is not a combination of multiple fields
export function TsVectorColTsQuery(col: string, val: string | TsQuery): Clause {
  return new tsQueryClause(col, val, true);
}

// TsVectorPlainToTsQuery is used when the column is not a tsvector field e.g.
// when there's an index just on the field and is not a combination of multiple fields
// TODO do these 4 need TsQuery because would be nice to have language?
// it seems to default to the config of the column
export function TsVectorPlainToTsQuery(
  col: string,
  val: string | TsQuery,
): Clause {
  return new plainToTsQueryClause(col, val, true);
}

// TsVectorPhraseToTsQuery is used when the column is not a tsvector field e.g.
// when there's an index just on the field and is not a combination of multiple fields
export function TsVectorPhraseToTsQuery(
  col: string,
  val: string | TsQuery,
): Clause {
  return new phraseToTsQueryClause(col, val, true);
}

// TsVectorWebsearchToTsQuery is used when the column is not a tsvector field e.g.
// when there's an index just on the field and is not a combination of multiple fields
export function TsVectorWebsearchToTsQuery(
  col: string,
  val: string | TsQuery,
): Clause {
  return new websearchTosQueryClause(col, val, true);
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

// These don't return Clauses but return helpful things that can be passed to clauses

// https://www.postgresql.org/docs/12/functions-json.html#FUNCTIONS-JSON-OP-TABLE
// see test in db_clause.test.ts
// unclear best time to use this...
export function JSONObjectFieldKeyASJSON(col: string, field: string) {
  return `${col}->'${field}'`;
}

export function JSONObjectFieldKeyAsText(col: string, field: string) {
  return `${col}->>'${field}'`;
}

// can't get this to work...
// https://www.postgresql.org/docs/12/functions-json.html#FUNCTIONS-JSON-OP-TABLE
// export function ArrayIndexAsText(col: string, index: number) {
//   return `${col}->>${index}`;
// }

type predicate = "==" | ">" | "<" | "!=" | ">=" | "<=";

class jSONPathValuePredicateClause implements Clause {
  constructor(
    protected col: string,
    protected path: string,
    protected value: any,
    private pred: predicate,
  ) {}

  clause(idx: number): string {
    if (DB.getDialect() !== Dialect.Postgres) {
      throw new Error(`not supported`);
    }
    return `${this.col} @@ $${idx}`;
  }

  columns(): string[] {
    return [this.col];
  }

  private wrap(val: any) {
    return `${this.path} ${this.pred} ${JSON.stringify(val)}`;
  }

  values(): any[] {
    if (isSensitive(this.value)) {
      return [this.wrap(this.value.value())];
    }

    return [this.wrap(this.value)];
  }

  logValues(): any[] {
    if (isSensitive(this.value)) {
      return [this.wrap(this.value.logValue())];
    }
    return [this.wrap(this.value)];
  }

  instanceKey(): string {
    return `${this.col}${this.path}${rawValue(this.value)}${this.pred}`;
  }
}

// https://www.postgresql.org/docs/12/functions-json.html#FUNCTIONS-JSON-OP-TABLE
export function JSONPathValuePredicate(
  dbCol: string,
  path: string,
  val: any,
  pred: predicate,
): Clause {
  return new jSONPathValuePredicateClause(dbCol, path, val, pred);
}
