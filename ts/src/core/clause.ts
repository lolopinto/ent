import { Data, ID, QueryableDataOptions, SelectDataOptions } from "./base";
import DB, { Dialect } from "./db";
import { buildQuery } from "./query_impl";

// NOTE: we use ? for sqlite dialect even though it supports $1 like postgres so that it'll be easier to support different dialects down the line

export interface Clause<T extends Data = Data, K = keyof T> {
  clause(idx: number, alias?: string): string;
  columns(): K[];
  values(): any[];
  instanceKey(): string;
  // values to log when querying
  logValues(): any[];
  // to indicate if a composite clause e.g. combining multiple things
  // one such reason is to be used by other composite clauses to know if to add parens
  // around a clause to ensure order of operations is met
  compositeOp?: string; // e.g. AND, OR etc
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

function renderCol<T extends Data, K = keyof T>(col: K, alias?: string) {
  if (alias) {
    return `${alias}.${col}`;
  }
  return col;
}

class simpleClause<T extends Data, K = keyof T> implements Clause<T, K> {
  constructor(
    protected col: K,
    private value: any,
    private op: string,
    private handleNull?: Clause<T, K>,
  ) {}

  clause(idx: number, alias?: string): string {
    const nullClause = this.nullClause();
    if (nullClause) {
      return nullClause.clause(idx, alias);
    }
    if (DB.getDialect() === Dialect.Postgres) {
      return `${renderCol(this.col, alias)} ${this.op} $${idx}`;
    }
    return `${renderCol(this.col, alias)} ${this.op} ?`;
  }

  private nullClause() {
    if (!this.handleNull || this.value !== null) {
      return;
    }
    return this.handleNull;
  }

  columns(): K[] {
    return [this.col];
  }

  values(): any[] {
    const nullClause = this.nullClause();
    if (nullClause) {
      return nullClause.values();
    }
    if (isSensitive(this.value)) {
      return [this.value.value()];
    }
    return [this.value];
  }

  logValues(): any[] {
    const nullClause = this.nullClause();
    if (nullClause) {
      return nullClause.logValues();
    }
    if (isSensitive(this.value)) {
      return [this.value.logValue()];
    }
    return [this.value];
  }

  instanceKey(): string {
    const nullClause = this.nullClause();
    if (nullClause) {
      return nullClause.instanceKey();
    }
    return `${this.col}${this.op}${rawValue(this.value)}`;
  }
}

// NB: we're not using alias in this class in clause method
// if we end up with a subclass that does, we need to handle it
class queryClause<T extends Data, K = keyof T> implements Clause<T, K> {
  constructor(
    protected dependentQueryOptions: QueryableDataOptions, // private value: any, // private op: string, // private handleNull?: Clause<T, K>,
    private prefix: string,
  ) {}

  clause(idx: number, alias?: string): string {
    const q = buildQuery(this.dependentQueryOptions);

    return `${this.prefix} (${q})`;
  }

  columns(): K[] {
    // @ts-ignore
    return this.dependentQueryOptions.clause.columns();
  }

  values(): any[] {
    return this.dependentQueryOptions.clause.values();
  }

  logValues(): any[] {
    return this.dependentQueryOptions.clause.logValues();
  }

  instanceKey(): string {
    return `${this.prefix.toLowerCase()}:${
      this.dependentQueryOptions.tableName
    }:${this.dependentQueryOptions.clause.instanceKey()}`;
  }
}

class existsQueryClause<T extends Data, K = keyof T> extends queryClause<T, K> {
  constructor(protected dependentQueryOptions: QueryableDataOptions) {
    super(dependentQueryOptions, "EXISTS");
  }
}

class isNullClause<T extends Data, K = keyof T> implements Clause<T, K> {
  constructor(protected col: K) {}

  clause(_idx: number, alias?: string): string {
    return `${renderCol(this.col, alias)} IS NULL`;
  }

  columns(): K[] {
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

class isNotNullClause<T extends Data, K = keyof T> implements Clause<T, K> {
  constructor(protected col: K) {}

  clause(idx: number, alias?: string): string {
    return `${renderCol(this.col, alias)} IS NOT NULL`;
  }

  columns(): K[] {
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

class simpleExpression<T extends Data, K = keyof T> implements Clause<T, K> {
  constructor(protected expression: string) {}

  clause(idx: number, alias?: string): string {
    return this.expression;
  }

  columns(): K[] {
    return [];
  }

  values(): any[] {
    return [];
  }

  logValues(): any[] {
    return [];
  }

  instanceKey(): string {
    return `${this.expression}`;
  }
}

class arraySimpleClause<T extends Data, K = keyof T> implements Clause<T, K> {
  constructor(
    protected col: K,
    private value: any,
    private op: string,
  ) {}

  clause(idx: number, alias?: string): string {
    if (DB.getDialect() === Dialect.Postgres) {
      return `$${idx} ${this.op} ANY(${renderCol(this.col, alias)})`;
    }
    return `${renderCol(this.col, alias)} ${this.op} ?`;
  }

  columns(): K[] {
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

class postgresArrayOperator<T extends Data, K = keyof T>
  implements Clause<T, K>
{
  constructor(
    protected col: K,
    protected value: any,
    private op: string,
    private not?: boolean,
  ) {}

  clause(idx: number, alias?: string): string {
    if (DB.getDialect() === Dialect.Postgres) {
      if (this.not) {
        return `NOT ${renderCol(this.col, alias)} ${this.op} $${idx}`;
      }
      return `${renderCol(this.col, alias)} ${this.op} $${idx}`;
    }
    throw new Error(`not supported`);
  }

  columns(): K[] {
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
      return [`{${this.value.logValue()}}`];
    }
    return [`{${this.value}}`];
  }

  instanceKey(): string {
    if (this.not) {
      return `NOT:${this.col}${this.op}${rawValue(this.value)}`;
    }
    return `${this.col}${this.op}${rawValue(this.value)}`;
  }
}

class postgresArrayOperatorList<
  T extends Data,
  K = keyof T,
> extends postgresArrayOperator<T, K> {
  constructor(col: K, value: any[], op: string, not?: boolean) {
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

  logValues(): any[] {
    return [
      `{${this.value
        .map((v: any) => {
          if (isSensitive(v)) {
            return v.logValue();
          }
          return v;
        })
        .join(", ")}}`,
    ];
  }
}

type InClauseOperator = "IN" | "NOT IN";

export class inClause<T extends Data, K = keyof T> implements Clause<T, K> {
  protected op: InClauseOperator = "IN";

  static getPostgresInClauseValuesThreshold() {
    return 70;
  }

  constructor(
    private col: K,
    private value: any[],
    private type = "uuid",
  ) {}

  clause(idx: number, alias?: string): string {
    // do a simple = when only one item
    if (this.value.length === 1) {
      if (this.op === "IN") {
        return new simpleClause(this.col, this.value[0], "=").clause(
          idx,
          alias,
        );
      } else {
        return new simpleClause(this.col, this.value[0], "!=").clause(
          idx,
          alias,
        );
      }
    }

    const postgres = DB.getDialect() === Dialect.Postgres;
    const postgresValuesList =
      postgres &&
      this.value.length >= inClause.getPostgresInClauseValuesThreshold();

    let indices: string[];
    if (postgres) {
      indices = [];
      for (let i = 0; i < this.value.length; i++) {
        if (postgresValuesList) {
          if (i === 0) {
            indices.push(`($${idx}::${this.type})`);
          } else {
            indices.push(`($${idx})`);
          }
        } else {
          indices.push(`$${idx}`);
        }
        idx++;
      }
    } else {
      indices = new Array(this.value.length);
      indices.fill("?", 0);
    }

    let inValue = indices.join(", ");

    // wrap in VALUES list for postgres...
    if (postgresValuesList) {
      inValue = `VALUES${inValue}`;
    }

    return `${renderCol(this.col, alias)} ${this.op} (${inValue})`;
    // TODO we need to return idx at end to query builder...
    // or anything that's doing a composite query so next clause knows where to start
    // or change to a sqlx.Rebind format
    // here's what sqlx does: https://play.golang.org/p/vPzvYqeAcP0
  }

  columns(): K[] {
    return [this.col];
  }

  values(): any[] {
    const result: any[] = [];
    for (let value of this.value) {
      result.push(rawValue(value));
    }
    return result;
  }

  logValues(): any[] {
    const result: any[] = [];
    for (let value of this.value) {
      result.push(isSensitive(value) ? value.logValue() : value);
    }
    return result;
  }

  instanceKey(): string {
    return `${this.op.toLowerCase()}:${this.col}:${this.values().join(",")}`;
  }
}

export class notInClause<T extends Data, K = keyof T> extends inClause<T, K> {
  protected op: InClauseOperator = "NOT IN";
}

class compositeClause<T extends Data, K = keyof T> implements Clause<T, K> {
  compositeOp: string;

  constructor(
    private clauses: Clause<T, K>[],
    private sep: string,
  ) {
    this.compositeOp = this.sep;
  }

  clause(idx: number, alias?: string): string {
    let clauses: string[] = [];
    for (const clause of this.clauses) {
      let cls = clause.clause(idx, alias);
      // if composite clause and a different op, add parens so that we enforce order of precedence
      if (clause.compositeOp && clause.compositeOp !== this.sep) {
        cls = `(${cls})`;
      }
      clauses.push(cls);
      idx = idx + clause.values().length;
    }
    return clauses.join(this.sep);
  }

  columns(): K[] {
    const ret: K[] = [];
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
    this.clauses.forEach((clause) => {
      if (clause.compositeOp && clause.compositeOp != this.sep) {
        keys.push(`(${clause.instanceKey()})`);
      } else {
        keys.push(clause.instanceKey());
      }
    });
    return keys.join(this.sep);
  }
}

class tsQueryClause<T extends Data, K = keyof T> implements Clause<T, K> {
  constructor(
    protected col: K,
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

  clause(idx: number, alias?: string): string {
    const { language } = this.getInfo();
    if (Dialect.Postgres === DB.getDialect()) {
      if (this.tsVectorCol) {
        return `to_tsvector(${renderCol(
          this.col,
          alias,
        )}) @@ ${this.getFunction()}('${language}', $${idx})`;
      }
      return `${renderCol(
        this.col,
        alias,
      )} @@ ${this.getFunction()}('${language}', $${idx})`;
    }
    // FYI this doesn't actually work for sqlite since different
    return `${renderCol(
      this.col,
      alias,
    )} @@ ${this.getFunction()}('${language}', ?)`;
  }

  columns(): K[] {
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

class plainToTsQueryClause<T extends Data, K = keyof T> extends tsQueryClause<
  T,
  K
> {
  protected getFunction(): string {
    return "plainto_tsquery";
  }
}

class phraseToTsQueryClause<T extends Data, K = keyof T> extends tsQueryClause<
  T,
  K
> {
  protected getFunction(): string {
    return "phraseto_tsquery";
  }
}

class websearchTosQueryClause<
  T extends Data,
  K = keyof T,
> extends tsQueryClause<T, K> {
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
export function PostgresArrayContainsValue<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new postgresArrayOperator(col, value, "@>");
}

/**
 * creates a clause to determine if every item in the list is stored in the array stored in the column in the db
 * only works with postgres gin indexes
 * https://www.postgresql.org/docs/current/indexes-types.html#INDEXES-TYPES-GIN
 */
export function PostgresArrayContains<T extends Data, K = keyof T>(
  col: K,
  value: any[],
): Clause<T, K> {
  return new postgresArrayOperatorList(col, value, "@>");
}

/**
 * creates a clause to determine if the given value is NOT contained in the array stored in the column in the db
 * only works with postgres gin indexes
 * https://www.postgresql.org/docs/current/indexes-types.html#INDEXES-TYPES-GIN
 */
export function PostgresArrayNotContainsValue<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new postgresArrayOperator(col, value, "@>", true);
}

/**
 * creates a clause to determine if every item in the list is NOT stored in the array stored in the column in the db
 * only works with postgres gin indexes
 * https://www.postgresql.org/docs/current/indexes-types.html#INDEXES-TYPES-GIN
 */
export function PostgresArrayNotContains<T extends Data, K = keyof T>(
  col: K,
  value: any[],
): Clause<T, K> {
  return new postgresArrayOperatorList(col, value, "@>", true);
}

/**
 * creates a clause to determine if the arrays overlap, that is, do they have any elements in common
 * only works with postgres gin indexes
 * https://www.postgresql.org/docs/current/indexes-types.html#INDEXES-TYPES-GIN
 */
export function PostgresArrayOverlaps<T extends Data, K = keyof T>(
  col: K,
  value: any[],
): Clause<T, K> {
  return new postgresArrayOperatorList(col, value, "&&");
}

/**
 * creates a clause to determine if the arrays do not overlap, that is, do they have any elements in common
 * only works with postgres gin indexes
 * https://www.postgresql.org/docs/current/indexes-types.html#INDEXES-TYPES-GIN
 */
export function PostgresArrayNotOverlaps<T extends Data, K = keyof T>(
  col: K,
  value: any[],
): Clause<T, K> {
  return new postgresArrayOperatorList(col, value, "&&", true);
}

/**
 * @deprecated use PostgresArrayContainsValue
 */
export function ArrayEq<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new arraySimpleClause(col, value, "=");
}

/**
 * @deprecated use PostgresNotArrayContains
 */
export function ArrayNotEq<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new arraySimpleClause(col, value, "!=");
}

export function Eq<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new simpleClause<T, K>(col, value, "=", new isNullClause(col));
}

export function StartsWith<T extends Data, K = keyof T>(
  col: K,
  value: string,
): Clause<T, K> {
  return new simpleClause<T, K>(col, `${value}%`, "LIKE");
}

export function EndsWith<T extends Data, K = keyof T>(
  col: K,
  value: string,
): Clause<T, K> {
  return new simpleClause<T, K>(col, `%${value}`, "LIKE");
}

export function Contains<T extends Data, K = keyof T>(
  col: K,
  value: string,
): Clause<T, K> {
  return new simpleClause<T, K>(col, `%${value}%`, "LIKE");
}

export function StartsWithIgnoreCase<T extends Data, K = keyof T>(
  col: K,
  value: string,
): Clause<T, K> {
  return new simpleClause<T, K>(col, `${value}%`, "ILIKE");
}

export function EndsWithIgnoreCase<T extends Data, K = keyof T>(
  col: K,
  value: string,
): Clause<T, K> {
  return new simpleClause<T, K>(col, `%${value}`, "ILIKE");
}

export function ContainsIgnoreCase<T extends Data, K = keyof T>(
  col: K,
  value: string,
): Clause<T, K> {
  return new simpleClause<T, K>(col, `%${value}%`, "ILIKE");
}

export function NotEq<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new simpleClause<T, K>(col, value, "!=", new isNotNullClause(col));
}

export function Greater<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new simpleClause<T, K>(col, value, ">");
}

export function Less<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new simpleClause<T, K>(col, value, "<");
}

export function GreaterEq<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new simpleClause<T, K>(col, value, ">=");
}

export function LessEq<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new simpleClause<T, K>(col, value, "<=");
}

export function And<T extends Data, K = keyof T>(
  ...args: Clause<T, K>[]
): Clause<T, K> {
  return new compositeClause(args, " AND ");
}

export function AndOptional<T extends Data, K = keyof T>(
  ...args: (Clause<T, K> | undefined)[]
): Clause<T, K> {
  // @ts-ignore
  let filtered: Clause<T, K>[] = args.filter((v) => v !== undefined);
  if (filtered.length === 1) {
    return filtered[0];
  }
  return And(...filtered);
}

export function Or<T extends Data, K = keyof T>(
  ...args: Clause<T, K>[]
): Clause<T, K> {
  return new compositeClause(args, " OR ");
}

export function OrOptional<T extends Data, K = keyof T>(
  ...args: (Clause<T, K> | undefined)[]
): Clause<T, K> {
  // @ts-ignore
  let filtered: Clause<T, K>[] = args.filter((v) => v !== undefined);
  if (filtered.length === 1) {
    return filtered[0];
  }
  return Or(...filtered);
}

/**
 * @deprecated use UUidIn, TextIn, IntegerIn, or TypeIn
 */
export function In<T extends Data, K = keyof T>(
  col: K,
  ...values: any
): Clause<T, K>;

/**
 * @deprecated use UUidIn, TextIn, IntegerIn, or TypeIn
 */
export function In<T extends Data, K = keyof T>(
  col: K,
  values: any[],
  type?: string,
): Clause<T, K>;

export function In<T extends Data, K = keyof T>(...args: any[]): Clause<T, K> {
  if (args.length < 2) {
    throw new Error(`invalid args passed to In`);
  }
  // 2nd overload
  if (Array.isArray(args[1])) {
    return new inClause(args[0], args[1], args[2]);
  }
  return new inClause(args[0], args.slice(1));
}

export function UuidIn<T extends Data, K = keyof T>(
  col: K,
  values: ID[],
): Clause<T, K> {
  return new inClause(col, values, "uuid");
}

export function IntegerIn<T extends Data, K = keyof T>(
  col: K,
  values: number[],
): Clause<T, K> {
  return new inClause(col, values, "integer");
}

export function TextIn<T extends Data, K = keyof T>(
  col: K,
  values: any[],
): Clause<T, K> {
  return new inClause(col, values, "text");
}

/*
 * if not uuid or text, pass the db type that can be used to cast this query
 * if we end up with a large list of ids
 */
export function DBTypeIn<T extends Data, K = keyof T>(
  col: K,
  values: any[],
  typ: string,
): Clause<T, K> {
  return new inClause(col, values, typ);
}

export function UuidNotIn<T extends Data, K = keyof T>(
  col: K,
  values: ID[],
): Clause<T, K> {
  return new notInClause(col, values, "uuid");
}

export function IntegerNotIn<T extends Data, K = keyof T>(
  col: K,
  values: number[],
): Clause<T, K> {
  return new notInClause(col, values, "integer");
}

export function TextNotIn<T extends Data, K = keyof T>(
  col: K,
  values: any[],
): Clause<T, K> {
  return new notInClause(col, values, "text");
}

/*
 * if not uuid or text, pass the db type that can be used to cast this query
 * if we end up with a large list of ids
 */
export function DBTypeNotIn<T extends Data, K = keyof T>(
  col: K,
  values: any[],
  typ: string,
): Clause<T, K> {
  return new notInClause(col, values, typ);
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
export function TsQuery<T extends Data, K = keyof T>(
  col: K,
  val: string | TsQuery,
): Clause<T, K> {
  return new tsQueryClause(col, val);
}

export function PlainToTsQuery<T extends Data, K = keyof T>(
  col: K,
  val: string | TsQuery,
): Clause<T, K> {
  return new plainToTsQueryClause(col, val);
}

export function PhraseToTsQuery<T extends Data, K = keyof T>(
  col: K,
  val: string | TsQuery,
): Clause<T, K> {
  return new phraseToTsQueryClause(col, val);
}

export function WebsearchToTsQuery<T extends Data, K = keyof T>(
  col: K,
  val: string | TsQuery,
): Clause<T, K> {
  return new websearchTosQueryClause(col, val);
}

// TsVectorColTsQuery is used when the column is not a tsvector field e.g.
// when there's an index just on the field and is not a combination of multiple fields
export function TsVectorColTsQuery<T extends Data, K = keyof T>(
  col: K,
  val: string | TsQuery,
): Clause<T, K> {
  return new tsQueryClause(col, val, true);
}

// TsVectorPlainToTsQuery is used when the column is not a tsvector field e.g.
// when there's an index just on the field and is not a combination of multiple fields
// TODO do these 4 need TsQuery because would be nice to have language?
// it seems to default to the config of the column
export function TsVectorPlainToTsQuery<T extends Data, K = keyof T>(
  col: K,
  val: string | TsQuery,
): Clause<T, K> {
  return new plainToTsQueryClause(col, val, true);
}

// TsVectorPhraseToTsQuery is used when the column is not a tsvector field e.g.
// when there's an index just on the field and is not a combination of multiple fields
export function TsVectorPhraseToTsQuery<T extends Data, K = keyof T>(
  col: K,
  val: string | TsQuery,
): Clause<T, K> {
  return new phraseToTsQueryClause(col, val, true);
}

// TsVectorWebsearchToTsQuery is used when the column is not a tsvector field e.g.
// when there's an index just on the field and is not a combination of multiple fields
export function TsVectorWebsearchToTsQuery<T extends Data, K = keyof T>(
  col: K,
  val: string | TsQuery,
): Clause<T, K> {
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
export function JSONObjectFieldKeyASJSON<T extends Data, K = keyof T>(
  col: K,
  field: string,
): keyof T {
  // type as keyof T to make it easier to use in other queries
  return `${col}->'${field}'`;
}

export function JSONObjectFieldKeyAsText<T extends Data, K = keyof T>(
  col: K,
  field: string,
): keyof T {
  // type as keyof T to make it easier to use in other queries
  return `${col}->>'${field}'`;
}

// can't get this to work...
// https://www.postgresql.org/docs/12/functions-json.html#FUNCTIONS-JSON-OP-TABLE
// export function ArrayIndexAsText(col: string, index: number) {
//   return `${col}->>${index}`;
// }

type predicate = "==" | ">" | "<" | "!=" | ">=" | "<=";

class jSONPathValuePredicateClause<T extends Data, K = keyof T>
  implements Clause<T, K>
{
  constructor(
    protected col: K,
    protected path: string,
    protected value: any,
    private pred: predicate,
  ) {}

  clause(idx: number, alias?: string): string {
    if (DB.getDialect() !== Dialect.Postgres) {
      throw new Error(`not supported`);
    }
    return `${renderCol(this.col, alias)} @@ $${idx}`;
  }

  columns(): K[] {
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
export function JSONPathValuePredicate<T extends Data, K = keyof T>(
  dbCol: K,
  path: string,
  val: any,
  pred: predicate,
): Clause<T, K> {
  return new jSONPathValuePredicateClause(dbCol, path, val, pred);
}

export function JSONKeyExists<T extends Data, K = keyof T>(
  dbCol: K,
  val: any,
): Clause<T, K> {
  return new simpleClause(dbCol, val, "?", new isNullClause(dbCol));
}

export function JSONBKeyInList<T extends Data, K = keyof T>(
  dbCol: K,
  jsonCol: string,
  val: any,
): Clause<T, K> {
  const opts: QueryableDataOptions = {
    fields: ["1"],
    tableName: `jsonb_array_elements(${dbCol}) AS json_element`,
    // @ts-ignore
    clause: And(
      JSONKeyExists("json_element", jsonCol),
      // @ts-ignore
      Eq(JSONObjectFieldKeyAsText<T, K>("json_element", jsonCol), val),
    ),
  };
  return new existsQueryClause(opts);
}

export function JSONKeyInList<T extends Data, K = keyof T>(
  dbCol: K,
  jsonCol: string,
  val: any,
): Clause<T, K> {
  const opts: QueryableDataOptions = {
    fields: ["1"],
    tableName: `json_array_elements(${dbCol}) AS json_element`,
    // @ts-ignore
    clause: And(
      JSONKeyExists("json_element", jsonCol),
      // @ts-ignore
      Eq(JSONObjectFieldKeyAsText<T, K>("json_element", jsonCol), val),
    ),
  };
  return new existsQueryClause(opts);
}

// TODO need a better name for this lol
// this assumes we're doing the same direction twice which isn't necessarily accurate in the future...
class paginationMultipleColumnsSubQueryClause<T extends Data, K = keyof T>
  implements Clause<T, K>
{
  constructor(
    private col: K,
    private op: string,
    private tableName: string,
    private uniqueCol: K,
    private val: any,
  ) {}

  private buildSimpleQuery(clause: Clause<T, K>, idx: number, alias?: string) {
    return `SELECT ${renderCol(this.col, alias)} FROM ${
      this.tableName
    } WHERE ${clause.clause(idx, alias)}`;
  }

  clause(idx: number, alias?: string): string {
    const eq1 = this.buildSimpleQuery(Eq(this.uniqueCol, this.val), idx, alias);
    const eq2 = this.buildSimpleQuery(
      Eq(this.uniqueCol, this.val),
      idx + 1,
      alias,
    );
    const op = new simpleClause(this.uniqueCol, this.val, this.op).clause(
      idx + 2,
      alias,
    );

    // nest in () to make sure it's scoped correctly
    return `(${renderCol(this.col, alias)} ${this.op} (${eq1}) OR (${renderCol(
      this.col,
      alias,
    )} = (${eq2}) AND ${op}))`;
  }

  columns(): K[] {
    return [this.col];
  }

  values(): any[] {
    return [this.val, this.val, this.val];
  }

  logValues(): any[] {
    const log = isSensitive(this.val) ? this.val.logValue() : this.val;
    return [log, log, log];
  }

  instanceKey(): string {
    return `${this.col}-${this.op}-${this.tableName}-${this.uniqueCol}-${this.val}`;
  }
}

export function PaginationMultipleColsSubQuery<T extends Data, K = keyof T>(
  col: K,
  op: string,
  tableName: string,
  uniqueCol: K,
  val: any,
): Clause<T, K> {
  return new paginationMultipleColumnsSubQueryClause(
    col,
    op,
    tableName,
    uniqueCol,
    val,
  );
}

// These 5 are used on the RHS of an expression
export function Add<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new simpleClause(col, value, "+", new isNullClause(col));
}

export function Subtract<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new simpleClause(col, value, "-", new isNullClause(col));
}

export function Multiply<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new simpleClause(col, value, "*", new isNullClause(col));
}

export function Divide<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new simpleClause(col, value, "/", new isNullClause(col));
}

export function Modulo<T extends Data, K = keyof T>(
  col: K,
  value: any,
): Clause<T, K> {
  return new simpleClause(col, value, "%", new isNullClause(col));
}

export function getCombinedClause<V extends Data = Data, K = keyof V>(
  options: Pick<SelectDataOptions, "clause">,
  cls: Clause<V, K>,
  checkIntersection?: boolean,
): Clause<V, K>;
export function getCombinedClause<V extends Data = Data, K = keyof V>(
  options: Pick<SelectDataOptions, "clause">,
  cls: Clause<V, K> | undefined,
  checkIntersection?: boolean,
): Clause<V, K> | undefined;
export function getCombinedClause<V extends Data = Data, K = keyof V>(
  options: Pick<SelectDataOptions, "clause">,
  cls: Clause<V, K> | undefined,
  checkIntersection = false,
): Clause<V, K> | undefined {
  if (options.clause) {
    let optionClause: Clause | undefined;
    if (typeof options.clause === "function") {
      optionClause = options.clause();
    } else {
      optionClause = options.clause;
    }
    if (optionClause) {
      let and = true;
      if (checkIntersection) {
        // this should be the smaller one
        const transformedCols = new Set<K | string | number>(
          optionClause.columns(),
        );
        const queriedCols = cls?.columns() ?? [];
        const has = new Set<K | string | number>();
        for (const col of queriedCols) {
          if (transformedCols.has(col)) {
            has.add(col);
          }
        }
        and = transformedCols.size > 0 && has.size !== transformedCols.size;
      }
      if (and) {
        // @ts-expect-error different types
        cls = AndOptional(cls, optionClause);
      }
    }
  }
  return cls;
}

export function Expression<T extends Data, K = keyof T>(
  expression: string,
): Clause<T, K> {
  return new simpleExpression(expression);
}
