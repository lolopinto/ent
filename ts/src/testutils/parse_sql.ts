import { Data } from "../core/base";

import {
  AST,
  Column,
  Delete,
  Insert_Replace,
  Parser,
  Select,
  Update,
} from "node-sql-parser";
//import { assert } from "console";
interface InsertReplace extends Insert_Replace {
  returning: any;
}

interface CustomUpdate extends Update {
  returning: any;
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

interface ColsInfo {
  allCols?: boolean;
  count?: boolean;
  columns?: string[];
}

function getColumns(cols: string[] | null | any[] | Column[] | "*"): ColsInfo {
  if (!cols) {
    return {};
  }
  if (cols === "*") {
    return { allCols: true };
  }
  let result: string[] = [];
  let count: boolean | undefined;
  for (let col of cols) {
    if (typeof col === "string") {
      result.push(col);
    } else {
      assert(col.type === "expr", "invalid col type");
      if (col.as !== "count") {
        // count supported as function below...
        assert(col.as === null, "column as not-null"); // TODO support this
      }
      assert(col.expr !== null, "null col expr");
      if (col.expr.column) {
        // regular column
        result.push(col.expr.column);
      } else if (col.expr.type === "function") {
        assert(
          col.expr.name === "count",
          "count is the only supported function for now",
        );
        // TODO count(col) is different. returns non-null or in our case undefined values
        assert(col.expr.args.type === "expr_list");
        if (col.expr.args.value?.length !== 1) {
          throw new Error("only one supported arg");
        }
        if (col.expr.args.value[0].value === 1) {
          count = true;
        } else {
          throw new Error(
            `only count(1) or count(*) supported. count(${col.expr.args.value[0].value}) not supported`,
          );
        }
      } else if (col.expr.type == "aggr_func") {
        assert(
          col.expr.name === "COUNT",
          "count is the only supported function for now",
        );
        if (col.expr.args?.expr?.type !== "star") {
          throw new Error("unsupported count expr");
        }
        count = true;
      } else {
        fail("unsupported expr type");
      }
    }
  }
  return { columns: result, count };
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

// regex from https://www.regextester.com/97766
const isoStringRegex =
  /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?$/;

function formatForReturn(val: any): any {
  if (typeof val === "string" && isoStringRegex.test(val)) {
    return new Date(val);
  }
  return val;
}

// go through the data and return it as needed
export function getDataToReturn(
  data: Data,
  colNames?: Set<string>,
  returningAll?: boolean,
): Data {
  let ret: Data = {};
  if (returningAll) {
    for (const key in data) {
      ret[key] = formatForReturn(data[key]);
    }
  } else if (colNames) {
    for (const key of colNames) {
      ret[key] = formatForReturn(data[key]);
    }
  } else {
    throw new Error(`must pass returningAll or colNames`);
  }
  return ret;
}

function parseInsertStatement(
  ast: InsertReplace,
  values: any[], // values passed to query
  returningAll: boolean,
): [string, Data, Data | null] {
  const tableName = getTableName(ast.table);
  const colInfo = getColumns(ast.columns);

  let data: Data = {};
  if (ast.values.length !== 1) {
    throw new Error(`unexpected number of values ${ast.values}`);
  }
  const val = ast.values[0];
  for (const val2 of val.value) {
    assert(isPreparedStatementValue(val2), "prepared statement");
  }
  assert(val.value.length == colInfo?.columns?.length, "cols values mismatch");
  const columns = colInfo?.columns!;

  // INSERT INTO tableName (cols) VALUES (pos args)
  for (let i = 0; i < columns.length; i++) {
    let col = columns[i];
    data[col] = values[i];
  }

  let returningData: Data | null = null;
  if (returningAll) {
    returningData = getDataToReturn(data, undefined, true);
  } else if (ast.returning) {
    assert(ast.returning.type === "returning");
    let returningCols = new Set<string>();
    for (const col of ast.returning.columns) {
      const colName = getColumnFromRef(col);
      if (data[colName] === undefined) {
        throw new Error(`invalid column ${colName}`);
      }
      returningCols.add(colName);
    }
    returningData = getDataToReturn(data, returningCols);
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

export class InOp {
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

export class AndOp {
  constructor(private ops: Where[]) {}

  apply(data: Data): boolean {
    return this.ops.every((op) => op.apply(data));
  }
}

export class OrOp {
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

// existing assert not throwing :(
function assert(val: boolean, msg?: string) {
  //  console.log(val);
  if (!val) {
    throw new Error(msg || "assertion error");
  }
}

function parseSelectStatement(
  ast: Select,
  values: any[], // values passed to query
  map: Map<string, Data[]>,
): Data[] {
  // TODO support these as needed
  // console.log(ast);
  // console.log(ast.groupby === null);
  assert(ast.groupby === null, "non-null groupby");
  assert(ast.having === null, "non-null having");
  assert(ast.with === null, "non-null with");
  assert(ast.distinct == null, "non-null distinct");
  assert(ast.options === null, "non-null options");

  const tableName = getTableName(ast.from);
  const colsInfo = getColumns(ast.columns);
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
    // TODO fix this
    if (colsInfo.count) {
      throw new Error("cannot do count and order by");
    }
  }
  let where = buildWhereStatement(ast, values);

  const list = map.get(tableName) || [];

  let results: Data[] = [];
  let limitApplied = false;

  for (const data of list) {
    if (where && !where.apply(data)) {
      continue;
    }
    if (colsInfo.allCols) {
      results.push(getDataToReturn(data, undefined, true));
    } else {
      let cols = new Set<string>();
      for (const col of colsInfo?.columns || []) {
        cols.add(col);
      }
      results.push(getDataToReturn(data, cols));
    }

    // don't apply limit early if there's an ordering or count
    if (
      orderings.length === 0 &&
      !colsInfo.count &&
      limit !== null &&
      limit == results.length
    ) {
      limitApplied = true;
      break;
    }
  }

  if (colsInfo.count) {
    // if doing count, we just count and return
    results = [{ count: results.length }];
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
      returnedRows.push(getDataToReturn(data, undefined, true));
    } else if (columns.size) {
      for (const col of columns) {
        if (data[col] === undefined) {
          throw new Error(`invalid column ${col}`);
        }
      }
      returnedRows.push(getDataToReturn(data, columns));
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

export interface queryResult {
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

function getAst(query: string): [AST | AST[] | undefined, boolean] {
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
      return [undefined, false];
  }

  let ast: AST | AST[];
  try {
    const p = new Parser();
    const parsed = p.parse(query, {
      database: "postgresql",
    });
    ast = parsed.ast;
  } catch (err) {
    console.trace();
    console.log(query, err);
    throw err;
  }
  return [ast!, returningAll];
}

export function performQuery(
  query: string,
  values: any[],
  map: Map<string, Data[]>,
): queryResult | undefined {
  const [ast, returningAll] = getAst(query);
  if (!ast) {
    return;
  }

  if (isInsertOrReplace(ast)) {
    const [tableName, data, returningData] = parseInsertStatement(
      ast,
      values,
      returningAll,
    );
    let list = map.get(tableName) || [];
    list.push(data);
    map.set(tableName, list);
    if (returningData !== null) {
      return newQueryResult({
        rows: [returningData],
        rowCount: 1,
      });
    }
  } else if (isSelect(ast)) {
    const results = parseSelectStatement(ast, values, map);

    return newQueryResult({
      rows: results,
      rowCount: results.length,
    });
  } else if (isUpdate(ast)) {
    const returning = parseUpdateStatement(ast, values, map, returningAll);
    return newQueryResult({
      rows: returning,
      rowCount: returning.length,
    });
  } else if (isDelete(ast)) {
    parseDeleteStatement(ast, values, map);
  }
}
