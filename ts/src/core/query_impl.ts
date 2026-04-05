import { stableStringify } from "./cache_utils";
import {
  QueryableDataOptions,
  SelectExpressionField,
  SelectField,
} from "./base";
import { QueryExpression } from "./query_expression";

export interface OrderByOption {
  column: string;
  direction: "ASC" | "DESC";
  alias?: string;
  nullsPlacement?: "first" | "last";
  expression?: QueryExpression;
}

export type OrderBy = OrderByOption[];

interface QueryFragmentInfo {
  phrase: string;
  values: any[];
  logValues: any[];
  valuesUsed: number;
}

export interface BuiltQueryData {
  query: string;
  values: any[];
  logValues: any[];
}

function isExpressionField(field: SelectField): field is SelectExpressionField {
  return typeof field === "object" && "expression" in field;
}

function getCacheKeyForExpression(expression: QueryExpression): string {
  return expression.instanceKey();
}

export function getSelectFieldsKey(fields: QueryableDataOptions["fields"]): string {
  return fields
    .map((field) => {
      if (typeof field === "string") {
        return field;
      }
      if (isExpressionField(field)) {
        return stableStringify({
          alias: field.alias,
          expression: getCacheKeyForExpression(field.expression),
        });
      }
      return stableStringify({
        alias: field.alias,
        column: field.column,
      });
    })
    .join(",");
}

export function getOrderByKey(orderby: OrderBy): string {
  return orderby
    .map((entry) =>
      stableStringify({
        column: entry.column,
        direction: entry.direction,
        alias: entry.alias,
        nullsPlacement: entry.nullsPlacement,
        expression: entry.expression
          ? getCacheKeyForExpression(entry.expression)
          : undefined,
      }),
    )
    .join("|");
}

export function orderByHasExpressions(orderby?: OrderBy): boolean {
  return orderby?.some((entry) => entry.expression !== undefined) ?? false;
}

function getFieldsInfo(
  fields: QueryableDataOptions["fields"],
  alias?: string,
  disableFieldsAlias?: boolean,
  clauseIdx = 1,
): QueryFragmentInfo {
  let valuesUsed = 0;
  const values: any[] = [];
  const logValues: any[] = [];
  const phrase = fields
    .map((field) => {
      if (typeof field === "string") {
        if (alias && !disableFieldsAlias) {
          return `${alias}.${field}`;
        }
        return field;
      }
      if (isExpressionField(field)) {
        const expression = field.expression;
        const rendered = expression.clause(
          clauseIdx + valuesUsed,
          disableFieldsAlias ? undefined : alias,
        );
        const expressionValues = expression.values();
        valuesUsed += expressionValues.length;
        values.push(...expressionValues);
        logValues.push(...expression.logValues());
        return `${rendered} AS ${field.alias}`;
      }
      if (!disableFieldsAlias) {
        return `${field.alias}.${field.column}`;
      }
      return field.column;
    })
    .join(", ");

  return {
    phrase,
    valuesUsed,
    values,
    logValues,
  };
}

export function getOrderByInfo(
  orderby: OrderBy,
  alias?: string,
  clauseIdx = 1,
): QueryFragmentInfo {
  let valuesUsed = 0;
  const values: any[] = [];
  const logValues: any[] = [];
  const phrase = orderby
    .map((entry) => {
      let nullsPlacement = "";
      switch (entry.nullsPlacement) {
        case "first":
          nullsPlacement = " NULLS FIRST";
          break;
        case "last":
          nullsPlacement = " NULLS LAST";
          break;
      }
      const orderByAlias = entry.alias ?? alias;
      let col = orderByAlias ? `${orderByAlias}.${entry.column}` : entry.column;
      if (entry.expression) {
        const rendered = entry.expression.clause(
          clauseIdx + valuesUsed,
          orderByAlias,
        );
        const expressionValues = entry.expression.values();
        valuesUsed += expressionValues.length;
        values.push(...expressionValues);
        logValues.push(...entry.expression.logValues());
        col = rendered;
      }
      return `${col} ${entry.direction}${nullsPlacement}`;
    })
    .join(", ");

  return {
    phrase,
    valuesUsed,
    values,
    logValues,
  };
}

export function getOrderByPhrase(orderby: OrderBy, alias?: string): string {
  return getOrderByInfo(orderby, alias).phrase;
}

export function reverseOrderBy(orderby: OrderBy): OrderBy {
  return orderby.map((o) => {
    const o2 = { ...o };
    o2.direction = o.direction === "ASC" ? "DESC" : "ASC";
    return o2;
  });
}

interface JoinInfo extends QueryFragmentInfo {}

export function getJoinInfo(
  join: NonNullable<QueryableDataOptions["join"]>,
  clauseIdx = 1,
): JoinInfo {
  let valuesUsed = 0;
  const values: any[] = [];
  const logValues: any[] = [];
  const phrase = join
    .map((join) => {
      const joinTable = join.alias
        ? `${join.tableName} ${join.alias}`
        : join.tableName;
      const joinValues = join.clause.values();
      const renderedClause = join.clause.clause(clauseIdx + valuesUsed);
      valuesUsed += joinValues.length;
      values.push(...joinValues);
      logValues.push(...join.clause.logValues());
      let joinType;
      switch (join.type) {
        case "left":
          joinType = "LEFT JOIN";
          break;
        case "right":
          joinType = "RIGHT JOIN";
          break;
        case "outer":
          joinType = "FULL OUTER JOIN";
          break;
        case "inner":
          joinType = "INNER JOIN";
          break;
        default:
          joinType = "JOIN";
      }
      return `${joinType} ${joinTable} ON ${renderedClause}`;
    })
    .join(" ");
  return {
    phrase,
    valuesUsed,
    values,
    logValues,
  };
}

export function buildQueryData(options: QueryableDataOptions): BuiltQueryData {
  const fieldsAlias = options.fieldsAlias ?? options.alias;
  const fieldInfo = getFieldsInfo(
    options.fields,
    fieldsAlias,
    options.disableFieldsAlias,
    1,
  );

  const values = [...fieldInfo.values];
  const logValues = [...fieldInfo.logValues];
  let clauseIdx = 1 + fieldInfo.valuesUsed;

  const parts: string[] = [];
  const tableName = options.alias
    ? `${options.tableName} AS ${options.alias}`
    : options.tableName;
  if (options.distinct) {
    parts.push(`SELECT DISTINCT ${fieldInfo.phrase} FROM ${tableName}`);
  } else {
    parts.push(`SELECT ${fieldInfo.phrase} FROM ${tableName}`);
  }

  if (options.join) {
    const joinInfo = getJoinInfo(options.join, clauseIdx);
    parts.push(joinInfo.phrase);
    values.push(...joinInfo.values);
    logValues.push(...joinInfo.logValues);
    clauseIdx += joinInfo.valuesUsed;
  }

  parts.push(`WHERE ${options.clause.clause(clauseIdx, options.alias)}`);
  values.push(...options.clause.values());
  logValues.push(...options.clause.logValues());
  clauseIdx += options.clause.values().length;

  if (options.groupby) {
    parts.push(`GROUP BY ${options.groupby}`);
  }
  if (options.orderby) {
    const orderByInfo = getOrderByInfo(
      options.orderby,
      options.disableDefaultOrderByAlias ? undefined : fieldsAlias,
      clauseIdx,
    );
    parts.push(`ORDER BY ${orderByInfo.phrase}`);
    values.push(...orderByInfo.values);
    logValues.push(...orderByInfo.logValues);
    clauseIdx += orderByInfo.valuesUsed;
  }
  if (options.limit !== undefined) {
    parts.push(`LIMIT ${options.limit}`);
  }
  if (options.offset !== undefined) {
    parts.push(`OFFSET ${options.offset}`);
  }
  return {
    query: parts.join(" "),
    values,
    logValues,
  };
}

export function buildQuery(options: QueryableDataOptions): string {
  return buildQueryData(options).query;
}
