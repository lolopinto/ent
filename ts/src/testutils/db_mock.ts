import { v4 as uuidv4 } from "uuid";
import { Pool, PoolClient } from "pg";
import { mocked } from "ts-jest/utils";
import { ID, Ent, Data } from "../core/ent";
import { Clause } from "../core/clause";

import {
  AST,
  Column,
  Delete,
  Insert_Replace,
  Parser,
  Select,
  Update,
} from "node-sql-parser";
import { assert } from "console";

const eventEmitter = {
  on: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
  setMaxListeners: jest.fn(),
  getMaxListeners: jest.fn(),
  listeners: jest.fn(),
  rawListeners: jest.fn(),
  emit: jest.fn(),
  listenerCount: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  eventNames: jest.fn(),
};

export interface queryOptions {
  query: string;
  values?: any[];
  qs?: internalQueryStructure | null;
}

export interface mockOptions {
  tableName: string;
  //  columns?: string[];
  clause: Clause;
  result: (values: any[]) => {};
}

export enum queryType {
  SELECT,
  INSERT,
  UPDATE,
  BEGIN,
  COMMIT,
  ROLLBACK,
}

export interface queryStructure {
  tableName?: string;
  type: queryType;
  //  columns?: string[];
  values?: any[];
}

interface internalQueryStructure extends queryStructure {
  query: string;
  columns?: string[];
  whereClause?: string;
  suffix?: string;
  setClause?: string;
}

function getTableName(table: any): string {
  if (Array.isArray(table)) {
    table = table[0];
  }
  if (typeof table.table === "string") {
    if (table.db !== null || table.as !== null) {
      throw new Error(
        "don't support complex table properties. table db/as not as expected",
      );
    }
    return table.table;
  }
  throw new Error(`unsupported table format ${table}`);
}

// returning & partition missing from Insert_Replace types...
function isInsertOrReplace(ast: AST[] | AST): ast is InsertReplace {
  const t = ast as Insert_Replace;
  return t.type === "replace" || t.type == "insert";
}

function isSelect(ast: AST[] | AST): ast is Select {
  return (ast as Select).type === "select";
}

function isUpdate(ast: AST[] | AST): ast is CustomUpdate {
  return (ast as Update).type === "update";
}

function isDelete(ast: AST[] | AST): ast is Delete {
  return (ast as Delete).type === "delete";
}

// interface Cols {
//   allColumns: boolean;
//   columns?: string[];
//   prepared
// }

function getColumns(cols: string[] | null | any[] | Column[] | "*"): string[] {
  if (!cols) {
    return [];
  }
  if (cols === "*") {
    // 1 col allCols
    return ["*"];
  }
  let result: string[] = [];
  for (let col of cols) {
    if (typeof col === "string") {
      result.push(col);
    } else {
      assert(col.type === "expr", "invalid col type");
      assert(col.as === null, "column as not-null"); // TODO support this
      //    assert(col.expr !== null);
      result.push(col.expr.column);
    }
  }
  return result;
}

function getColumnFromRef(col: any): string {
  assert(col !== null, "null column ref");
  assert(col.type === "column_ref", "column type column_ref");
  assert(col.table === null, "column table not null");
  return col.column;
}

function isPreparedStatementValue(val: any) {
  if (val.type !== "origin") {
    return false;
  }
  let str = val.value as string;

  // TODO this should work for not-postgres
  return str.startsWith("$");
}

interface InsertReplace extends Insert_Replace {
  returning: any;
}

interface CustomUpdate extends Update {
  returning: any;
}

function parseInsertStatement(
  ast: InsertReplace,
  values: any[], // values passed to query
): [string, Data, Data | null] {
  const tableName = getTableName(ast.table);
  const columns = getColumns(ast.columns);

  let data: Data = {};
  if (ast.values.length !== 1) {
    throw new Error(`unexpected number of values ${ast.values}`);
  }
  const val = ast.values[0];
  for (const val2 of val.value) {
    assert(isPreparedStatementValue(val2), "prepared statement");
  }
  assert(val.value.length == columns.length, "cols values mismatch");

  // INSERT INTO tableName (cols) VALUES (pos args)
  for (let i = 0; i < columns.length; i++) {
    let col = columns[i];
    data[col] = values[i];
  }

  let returningData: Data | null = null;
  if (ast.returning) {
    returningData = {};
    assert(ast.returning.type === "returning");
    for (const col of ast.returning.columns) {
      const colName = getColumnFromRef(col);
      if (data[colName] === undefined) {
        throw new Error(`invalid column ${colName}`);
      }
      returningData[colName] = data[colName];
    }
  }
  return [tableName, data, returningData];
}

export interface Where {
  // if returns true, row should be returned
  apply(data: Data): boolean;
}

export class EqOp {
  constructor(private col: string, private value: any) {}

  apply(data: Data): boolean {
    return data[this.col] === this.value;
  }
}

export class GreaterOp {
  constructor(private col: string, private value: any) {}

  apply(data: Data): boolean {
    return data[this.col] > this.value;
  }
}

export class LessOp {
  constructor(private col: string, private value: any) {}

  apply(data: Data): boolean {
    return data[this.col] < this.value;
  }
}

export class GreaterEqOp {
  constructor(private col: string, private value: any) {}

  apply(data: Data): boolean {
    return data[this.col] >= this.value;
  }
}

export class LessEqOp {
  constructor(private col: string, private value: any) {}

  apply(data: Data): boolean {
    return data[this.col] <= this.value;
  }
}

class InOp {
  constructor(private col: string, private values: any[]) {}

  apply(data: Data): boolean {
    for (const val of this.values) {
      if (data[this.col] == val) {
        return true;
      }
    }
    return false;
  }
}

class AndOp {
  constructor(private ops: Where[]) {}

  apply(data: Data): boolean {
    return this.ops.every((op) => op.apply(data));
  }
}

class OrOp {
  constructor(private ops: Where[]) {}

  apply(data: Data): boolean {
    return this.ops.some((op) => op.apply(data));
  }
}

function getValues(root: any, values: any[]): any[] {
  for (const val2 of root) {
    assert(isPreparedStatementValue(val2), "prepared statement");
  }
  // TODO support non-prepared statement vlaues
  return values;
}

const preparedRegex = new RegExp(/\$(\d+)/);
function getValueFromRegex(val: any, values: any[]): any {
  // TODO support non-prepared statements
  assert(isPreparedStatementValue(val), "prepared statement");

  const result = preparedRegex.exec(val.value);
  assert(result !== null);
  let pos: number = parseInt(result![1], 10);
  return values[pos - 1];
}

function getOp(where: any, values: any[]): Where {
  let col: string;
  let value: any;

  switch (where.operator) {
    case "=":
      col = getColumnFromRef(where.left);
      value = getValueFromRegex(where.right, values);
      return new EqOp(col, value);

    case ">":
      col = getColumnFromRef(where.left);
      value = getValueFromRegex(where.right, values);
      return new GreaterOp(col, value);

    case "<":
      col = getColumnFromRef(where.left);
      value = getValueFromRegex(where.right, values);
      return new LessOp(col, value);

    case ">=":
      col = getColumnFromRef(where.left);
      value = getValueFromRegex(where.right, values);
      return new GreaterEqOp(col, value);

    case "<=":
      col = getColumnFromRef(where.left);
      value = getValueFromRegex(where.right, values);
      return new LessEqOp(col, value);

    case "IN":
      col = getColumnFromRef(where.left);
      assert(where.right.type === "expr_list");
      // TODo support non prepared statement
      let vals = getValues(where.right.value, values);
      return new InOp(col, vals);

    case "AND":
      return new AndOp([getOp(where.left, values), getOp(where.right, values)]);
    case "OR":
      return new OrOp([getOp(where.left, values), getOp(where.right, values)]);

    default:
      console.log(where);
      throw new Error(`unsupported op ${where.operator}`);
  }
}

function buildWhereStatement(ast: Select, values: any[]): Where | null {
  if (ast.where === null) {
    return null;
  }

  assert(ast.where.type === "binary_expr", "valid where");

  return getOp(ast.where, values);
}

function parseSelectStatement(
  ast: Select,
  values: any[], // values passed to query
  map: Map<string, Data[]>,
): Data[] {
  // TODO support these as needed
  assert(ast.groupby === null, "non-null groupby");
  assert(ast.having === null), "non-null having";
  assert(ast.with === null, "non-null with");
  assert(ast.distinct == null, "non-null distinct");
  assert(ast.options === null, "non-null options");

  const tableName = getTableName(ast.from);
  const columns = getColumns(ast.columns);
  const allColumns = columns.length == 1 && columns[0] == "*";

  //  console.log(tableName, columns, allColumns);

  let limit: number | null = null;
  if (ast.limit !== null) {
    assert(ast.limit.seperator == "", "ast limit separator not as expected");
    assert(ast.limit.value.length == 1, "ast limit not as expected");
    assert(ast.limit.value[0].type == "number", "limit type was not 0");
    limit = ast.limit.value[0].value;
  }
  let orderings: [string, string][] = [];
  if (ast.orderby !== null) {
    for (const order of ast.orderby) {
      const col = getColumnFromRef(order.expr);
      orderings.push([col, order.type]);
    }
  }
  let where = buildWhereStatement(ast, values);

  const list = map.get(tableName) || [];

  let results: Data[] = [];
  let limitApplied = false;

  if (where) {
    for (const data of list) {
      if (where.apply(data)) {
        if (allColumns) {
          results.push(data);
        } else {
          let result = {};
          for (const col of columns) {
            if (data[col] === undefined) {
              throw new Error("requested a non-existing column");
            }
            result[col] = data[col];
          }
          results.push(result);
        }
      }

      // don't apply limit early if there's an ordering
      if (orderings.length === 0 && limit !== null && limit == results.length) {
        limitApplied = true;
        break;
      }
    }
  } else {
    results = [...list];
  }

  for (const order of orderings) {
    const [col, type] = order;

    results.sort((a, b) => {
      if (type === "ASC") {
        if (a[col] > b[col]) {
          return 1;
        }
        if (a[col] < b[col]) {
          return -1;
        }
        return 0;
      }
      // DESC
      if (a[col] > b[col]) {
        return -1;
      }
      if (a[col] < b[col]) {
        return 1;
      }
      return 0;
    });
  }

  // apply limit after if not applied e.g. there was an ordering or no where clause
  if (limit !== null && !limitApplied) {
    results = results.slice(0, limit);
  }

  return results;
}

function parseUpdateStatement(
  ast: CustomUpdate,
  values: any[],
  map: Map<string, Data[]>,
  returningAll: boolean,
) {
  const tableName = getTableName(ast.table);
  let op: Where | null = null;
  if (ast.where) {
    op = getOp(ast.where, values);
  }
  assert(Array.isArray(ast.set));
  let overwrite: Data = {};
  for (const set of ast.set) {
    let col = set.column;
    let value = getValueFromRegex(set.value, values);
    overwrite[col] = value;
  }

  let columns = new Set<string>();
  if (ast.returning) {
    assert(ast.returning.type === "returning");
    for (const col of ast.returning.columns) {
      const colName = getColumnFromRef(col);
      columns.add(colName);
    }
  }

  // overwrite the row
  let list = map.get(tableName) || [];
  let returnedRows: Data[] = [];
  for (let i = 0; i < list.length; i++) {
    let data = list[i];

    if (op && !op.apply(data)) {
      continue;
    }

    for (const key in overwrite) {
      data[key] = overwrite[key];
    }
    list[i] = data;

    if (returningAll) {
      returnedRows.push(data);
    } else if (columns.size) {
      let returning: Data = {};
      for (const col of columns) {
        if (data[col] === undefined) {
          throw new Error(`invalid column ${col}`);
        }
        returning[col] = data[col];
      }
      returnedRows.push(returning);
    }
  }
  map.set(tableName, list);
  return returnedRows;
}

function parseDeleteStatement(
  ast: Delete,
  values: any[],
  map: Map<string, Data[]>,
) {
  const tableName = getTableName(ast.table);
  let list = map.get(tableName) || [];
  if (!ast.where) {
    map.set(tableName, []);
    return;
  }

  const op = getOp(ast.where, values);

  for (let i = 0; i < list.length; i++) {
    let data = list[i];
    if (op.apply(data)) {
      list.splice(i, 1);
      // to fix indices
      i--;
      map.set(tableName, list);
    }
  }
}

interface queryResult {
  rows: Data[];
  rowCount: number;
  oid: number;
  fields: any[];
  command: string;
}

function newQueryResult(partial: Partial<queryResult>): queryResult {
  return {
    rows: [],
    rowCount: 0,
    oid: 0,
    fields: [],
    command: "",
    ...partial,
  };
}

export class QueryRecorder {
  private static queries: queryOptions[] = [];
  private static ids: ID[] = [];

  // we need pkeys when storing...
  private static data: Map<string, Data[]> = new Map();

  // TODO kill
  private static getQueryStructure(query): internalQueryStructure | null {
    // we parsing sql now??
    // slowing building sqlshim?
    // make it so that we return the values entered back when mocking the db

    if (/^INSERT/.test(query)) {
      let execArray = /INSERT INTO (.+) \((.+)\) VALUES \((.+)\) (.+)?/.exec(
        query,
      );
      if (execArray) {
        return {
          tableName: execArray[1],
          columns: execArray[2].split(", "),
          type: queryType.INSERT,
          query: execArray[0],
          suffix: execArray[4],
        };
      }
      return null;
    }

    if (/^SELECT/.test(query)) {
      let execArray = /^SELECT (.+) FROM (.+) WHERE (.+)?/.exec(query);
      if (execArray) {
        return {
          tableName: execArray[2],
          whereClause: execArray[3],
          type: queryType.SELECT,
          query: execArray[0],
          columns: execArray[1].split(", "),
        };
      }
    }

    if (/^UPDATE/.test(query)) {
      // regex can't do returning
      let execArray = /^UPDATE (.+) SET (.+) WHERE (.+) /.exec(query);
      if (execArray) {
        return {
          tableName: execArray[1],
          // not completely accurate
          whereClause: execArray[3],
          type: queryType.UPDATE,
          query: execArray[0],
          setClause: execArray[2],
          //          colummns: execArray[1].split(", "),
        };
      }
    }
    return null;
  }

  private static recordQuery(
    query: string,
    values: any[],
  ): queryResult | undefined {
    let qs = QueryRecorder.getQueryStructure(query);
    QueryRecorder.queries.push({
      query: query,
      values: values,
      qs: qs,
    });

    //    console.log(query, values);
    let idx = query.indexOf("RETURNING *");
    let returningAll: boolean = false;
    if (idx !== -1) {
      query = query.substr(0, idx);
      returningAll = true;
    }

    let idx2 = query.indexOf("ON CONFLICT");
    if (idx2 !== -1) {
      //      console.log(query);
      query = query.substr(0, idx2);
      // we don't care about on conflict since we just write regardless of pkey
    }

    // nothing to do here
    switch (query) {
      case "BEGIN":
      case "ROLLBACK":
      case "COMMIT":
        return;
    }

    let ast: AST | AST[];
    try {
      const p = new Parser();
      const parsed = p.parse(query, {
        database: "postgresql",
      });
      ast = parsed.ast;
    } catch (err) {
      console.log(query, err);
      throw err;
    }
    ast = ast!;
    if (isInsertOrReplace(ast)) {
      const [tableName, data, returningData] = parseInsertStatement(
        ast,
        values,
      );
      let list = QueryRecorder.data.get(tableName) || [];
      list.push(data);
      QueryRecorder.data.set(tableName, list);
      if (returningData !== null) {
        return newQueryResult({
          rows: [returningData],
          rowCount: 1,
        });
      }
      if (returningAll) {
        return newQueryResult({
          rows: [data],
          rowCount: 1,
        });
      }
    } else if (isSelect(ast)) {
      const results = parseSelectStatement(ast, values, QueryRecorder.data);

      return newQueryResult({
        rows: results,
        rowCount: results.length,
      });
    } else if (isUpdate(ast)) {
      const returning = parseUpdateStatement(
        ast,
        values,
        QueryRecorder.data,
        returningAll,
      );
      return newQueryResult({
        rows: returning,
        rowCount: returning.length,
      });
    } else if (isDelete(ast)) {
      parseDeleteStatement(ast, values, QueryRecorder.data);
    }
  }

  static newID(): ID {
    let id = uuidv4();
    QueryRecorder.ids.push(id);
    return id;
  }

  static getCurrentIDs(): ID[] {
    return QueryRecorder.ids;
  }

  static getData() {
    return QueryRecorder.data;
  }

  static clear() {
    QueryRecorder.queries = [];
    QueryRecorder.ids = [];
    QueryRecorder.data = new Map();
  }

  static clearQueries() {
    // clears queries but keeps data
    // this is useful for situations like write this data before each test
    // but each test shouldn't have to account for this
    QueryRecorder.queries = [];
  }

  static getCurrentQueries(): queryOptions[] {
    return QueryRecorder.queries;
  }

  static validateQueriesInTx(expected: queryOptions[], ent: Ent | null) {
    expected.unshift({ query: "BEGIN" });
    expected.push({ query: "COMMIT" });
    this.validateQueryOrder(expected, ent);
  }

  static validateFailedQueriesInTx(expected: queryOptions[], ent: Ent | null) {
    expected.unshift({ query: "BEGIN" });
    expected.push({ query: "ROLLBACK" });
    this.validateQueryOrder(expected, ent);
  }

  static validateQueryOrder(expected: queryOptions[], ent: Ent | null) {
    let queries = QueryRecorder.queries;
    //console.log(queries, expected);
    expect(queries.length).toBe(expected.length);

    for (let i = 0; i < expected.length; i++) {
      expect(queries[i].query, `${i}th query`).toBe(expected[i].query);

      if (expected[i].values === undefined) {
        expect(queries[i].values, `${i}th query`).toBe(undefined);
      } else {
        let expectedVals = expected[i].values!;
        let actualVals = queries[i].values!;
        expect(actualVals.length, `${i}th query`).toBe(expectedVals.length);

        for (let j = 0; j < expectedVals.length; j++) {
          let expectedVal = expectedVals[j];
          let actualVal = actualVals[j];

          if (expectedVal === "{id}") {
            expectedVal = ent?.id;
          }
          expect(actualVal, `${i}th query`).toStrictEqual(expectedVal);
        }
      }
    }
  }

  static validateQueryStructuresInTx(
    expected: queryStructure[],
    pre?: queryStructure[],
  ) {
    expected.unshift({ type: queryType.BEGIN });
    expected.push({ type: queryType.COMMIT });
    // we don't care about reads so skipping them for now.
    let pre2 = pre || [];
    expected.unshift(...pre2);
    this.validateQueryStructures(expected, true);
  }

  static validateFailedQueryStructuresInTx(
    expected: queryStructure[],
    pre?: queryStructure[],
  ) {
    expected.unshift({ type: queryType.BEGIN });
    expected.push({ type: queryType.ROLLBACK });
    // we don't care about reads so skipping them for now.
    let pre2 = pre || [];
    expected.unshift(...pre2);
    this.validateQueryStructures(expected, true);
  }

  static validateQueryStructures(
    expected: queryStructure[],
    skipSelect: boolean,
  ) {
    let queries = QueryRecorder.queries;
    if (skipSelect) {
      queries = queries.filter((query) => query.qs?.type !== queryType.SELECT);
    }
    //    console.log(queries, expected);
    expect(queries.length).toBe(expected.length);

    for (let i = 0; i < expected.length; i++) {
      let expectedStructure = expected[i];
      let query = queries[i];
      switch (expectedStructure.type) {
        case queryType.BEGIN:
          expect(query.query).toBe("BEGIN");
          expect(query.values).toBe(undefined);
          break;
        case queryType.ROLLBACK:
          expect(query.query).toBe("ROLLBACK");
          expect(query.values).toBe(undefined);
          break;
        case queryType.COMMIT:
          expect(query.query).toBe("COMMIT");
          expect(query.values).toBe(undefined);
          break;
        case queryType.SELECT:
          if (!skipSelect) {
            console.error(
              "validating select query structure not supported yet",
            );
          }
          // TODO INSERT and UPDATE tests here...
          // should be easy...
          break;
        case queryType.INSERT:
          expect(query.query.startsWith("INSERT")).toBe(true);
          expect(query.qs?.tableName).toBe(expectedStructure.tableName);
          break;
        case queryType.UPDATE:
          expect(query.query.startsWith("UPDATE")).toBe(true);
          expect(query.qs?.tableName).toBe(expectedStructure.tableName);
          break;
      }
    }
  }

  static mockPool(pool: typeof Pool) {
    const mockedPool = mocked(pool, true);
    mockedPool.mockImplementation(
      (): Pool => {
        return {
          totalCount: 1,
          idleCount: 1,
          waitingCount: 1,
          connect: async (): Promise<PoolClient> => {
            return {
              connect: jest.fn(),
              release: jest.fn(),
              query: jest
                .fn()
                .mockImplementation((query: string, values: any[]) => {
                  return QueryRecorder.recordQuery(query, values);
                }),
              copyFrom: jest.fn(),
              copyTo: jest.fn(),
              pauseDrain: jest.fn(),
              resumeDrain: jest.fn(),
              escapeIdentifier: jest.fn(),
              escapeLiteral: jest.fn(),

              // EventEmitter
              ...eventEmitter,
            };
          },
          end: jest.fn(),
          query: jest.fn().mockImplementation(QueryRecorder.recordQuery),

          // EventEmitter
          ...eventEmitter,
        };
      },
    );
  }
}

// TODO
process.env.DB_CONNECTION_STRING = "ss";
