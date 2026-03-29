import pg, { type Pool } from "pg";
import {
  type Clause,
  BaseField,
  type DBExtension,
  DBType,
  type Field,
  type FieldOptions,
  type Index,
  ParameterizedExpression,
  type QueryExpression,
  registerExtensionRuntime,
  type SelectExpressionField,
  type OrderByOption,
  type Type,
} from "@snowtop/ent";

export type VectorLike = number[] | Float32Array | Float64Array;

export type VectorMetric = "l2" | "cosine" | "inner_product" | "l1";

export interface VectorFieldOptions extends FieldOptions {
  dimensions: number;
}

export interface VectorExpressionOptions {
  metric?: VectorMetric;
  key?: string;
}

export interface VectorDistanceFieldOptions extends VectorExpressionOptions {
  alias?: string;
}

export interface VectorOrderByOptions extends VectorExpressionOptions {
  alias?: string;
  columnAlias?: string;
  direction?: "ASC" | "DESC";
  nullsPlacement?: "first" | "last";
}

export interface NearestNeighborOptions extends VectorOrderByOptions {
  fieldAlias?: string;
}

export interface HNSWIndexOptions {
  name: string;
  column: string;
  metric?: VectorMetric;
  concurrently?: boolean;
  where?: string;
  m?: number;
  efConstruction?: number;
}

export interface IVFFlatIndexOptions {
  name: string;
  column: string;
  metric?: VectorMetric;
  concurrently?: boolean;
  where?: string;
  lists: number;
}

const VECTOR_EXTENSION_NAME = "vector";
const VECTOR_TYPE_NAME = "vector";
const DEFAULT_RUNTIME_SCHEMAS = ["public"];
const DEFAULT_DISTANCE_ALIAS = "distance";

const VECTOR_OPERATORS: Record<VectorMetric, string> = {
  l2: "<->",
  cosine: "<=>",
  inner_product: "<#>",
  l1: "<+>",
};

const VECTOR_OPERATOR_CLASSES: Record<VectorMetric, string> = {
  l2: "vector_l2_ops",
  cosine: "vector_cosine_ops",
  inner_product: "vector_ip_ops",
  l1: "vector_l1_ops",
};

const registeredTypeOIDs = new Set<number>();

function isTypedNumericArray(value: unknown): value is Float32Array | Float64Array {
  return (
    ArrayBuffer.isView(value) &&
    !(value instanceof DataView) &&
    (value instanceof Float32Array || value instanceof Float64Array)
  );
}

function normalizeMetric(metric?: VectorMetric): VectorMetric {
  return metric ?? "cosine";
}

function renderColumn(column: string, alias?: string) {
  if (column.includes(".")) {
    return column;
  }
  if (alias) {
    return `${alias}.${column}`;
  }
  return column;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function vectorKey(prefix: string, column: string, metric: VectorMetric, vector: string) {
  return `${prefix}:${column}:${metric}:${vector.length}:${hashString(vector)}`;
}

function validatePositiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

export function normalizeVector(
  value: VectorLike,
  dimensions?: number,
): number[] {
  let entries: number[];
  if (Array.isArray(value)) {
    entries = [...value];
  } else if (isTypedNumericArray(value)) {
    entries = Array.from(value);
  } else {
    throw new Error("vector value must be a number[] or float typed array");
  }

  if (dimensions !== undefined) {
    validatePositiveInteger(dimensions, "dimensions");
    if (entries.length !== dimensions) {
      throw new Error(
        `vector value must have ${dimensions} dimensions; received ${entries.length}`,
      );
    }
  }

  entries.forEach((entry, idx) => {
    if (typeof entry !== "number" || !Number.isFinite(entry)) {
      throw new Error(`vector value at index ${idx} must be a finite number`);
    }
  });

  return entries;
}

export function serializeVector(vector: VectorLike, dimensions?: number): string {
  return `[${normalizeVector(vector, dimensions).join(",")}]`;
}

export function parseVectorLiteral(value: string | null | undefined): number[] | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return [];
  }
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    throw new Error(`invalid vector literal ${value}`);
  }
  const inner = trimmed.slice(1, -1).trim();
  if (inner === "") {
    return [];
  }
  return inner.split(",").map((entry, idx) => {
    const parsed = Number(entry.trim());
    if (!Number.isFinite(parsed)) {
      throw new Error(`invalid vector element at index ${idx} in ${value}`);
    }
    return parsed;
  });
}

function getOperator(metric?: VectorMetric): string {
  return VECTOR_OPERATORS[normalizeMetric(metric)];
}

export function getVectorOperatorClass(metric?: VectorMetric): string {
  return VECTOR_OPERATOR_CLASSES[normalizeMetric(metric)];
}

function buildDistanceExpression(
  column: string,
  vector: VectorLike,
  options?: VectorExpressionOptions,
): QueryExpression {
  const metric = normalizeMetric(options?.metric);
  const serialized = serializeVector(vector);
  return ParameterizedExpression(
    options?.key ?? vectorKey("distance", column, metric, serialized),
    (idx, alias) =>
      `${renderColumn(column, alias)} ${getOperator(metric)} $${idx}::vector`,
    [serialized],
  );
}

class WithinDistanceClause implements Clause {
  constructor(
    private column: string,
    private vector: string,
    private maxDistance: number,
    private metric: Exclude<VectorMetric, "inner_product">,
  ) {}

  clause(idx: number, alias?: string): string {
    return `${renderColumn(this.column, alias)} ${getOperator(this.metric)} $${idx}::vector < $${idx + 1}`;
  }

  columns(): never[] {
    return [];
  }

  values(): any[] {
    return [this.vector, this.maxDistance];
  }

  logValues(): any[] {
    return [this.vector, this.maxDistance];
  }

  instanceKey(): string {
    return `${vectorKey("within", this.column, this.metric, this.vector)}:<${this.maxDistance}`;
  }
}

export class VectorField extends BaseField implements Field {
  type: Type;
  dimensions: number;
  hideFromGraphQL = true;

  constructor(dimensions: number) {
    super();
    validatePositiveInteger(dimensions, "dimensions");
    this.dimensions = dimensions;
    this.type = {
      dbType: DBType.String,
      type: "number[]",
      postgresType: `vector(${dimensions})`,
      dbExtension: VECTOR_EXTENSION_NAME,
    };
  }

  valid(value: any): boolean {
    try {
      normalizeVector(value, this.dimensions);
      return true;
    } catch {
      return false;
    }
  }

  format(value: any): any {
    return serializeVector(value, this.dimensions);
  }
}

export function VectorType(options: VectorFieldOptions): VectorField {
  const { dimensions, ...fieldOptions } = options;
  const field = new VectorField(dimensions);
  return Object.assign(field, fieldOptions);
}

export function PgVectorExtension(
  extension: Omit<DBExtension, "name"> = {},
): DBExtension {
  return {
    name: VECTOR_EXTENSION_NAME,
    runtimeSchemas: extension.runtimeSchemas ?? DEFAULT_RUNTIME_SCHEMAS,
    ...extension,
  };
}

export function l2Distance(
  column: string,
  vector: VectorLike,
  options?: Omit<VectorExpressionOptions, "metric">,
): QueryExpression {
  return buildDistanceExpression(column, vector, { ...options, metric: "l2" });
}

export function cosineDistance(
  column: string,
  vector: VectorLike,
  options?: Omit<VectorExpressionOptions, "metric">,
): QueryExpression {
  return buildDistanceExpression(column, vector, {
    ...options,
    metric: "cosine",
  });
}

export function l1Distance(
  column: string,
  vector: VectorLike,
  options?: Omit<VectorExpressionOptions, "metric">,
): QueryExpression {
  return buildDistanceExpression(column, vector, { ...options, metric: "l1" });
}

export function negativeInnerProduct(
  column: string,
  vector: VectorLike,
  options?: Omit<VectorExpressionOptions, "metric">,
): QueryExpression {
  return buildDistanceExpression(column, vector, {
    ...options,
    metric: "inner_product",
  });
}

export function maxInnerProduct(
  column: string,
  vector: VectorLike,
  options?: Omit<VectorExpressionOptions, "metric">,
): QueryExpression {
  const serialized = serializeVector(vector);
  return ParameterizedExpression(
    options?.key ??
      `${vectorKey("max_inner_product", column, "inner_product", serialized)}:* -1`,
    (idx, alias) =>
      `(${renderColumn(column, alias)} ${getOperator("inner_product")} $${idx}::vector) * -1`,
    [serialized],
  );
}

export function cosineSimilarity(
  column: string,
  vector: VectorLike,
  options?: Omit<VectorExpressionOptions, "metric">,
): QueryExpression {
  const serialized = serializeVector(vector);
  return ParameterizedExpression(
    options?.key ??
      `${vectorKey("cosine_similarity", column, "cosine", serialized)}:1-`,
    (idx, alias) =>
      `1 - (${renderColumn(column, alias)} ${getOperator("cosine")} $${idx}::vector)`,
    [serialized],
  );
}

export function withinDistance(
  column: string,
  vector: VectorLike,
  maxDistance: number,
  metric: Exclude<VectorMetric, "inner_product"> = "l2",
): Clause {
  if (!Number.isFinite(maxDistance)) {
    throw new Error("maxDistance must be a finite number");
  }
  return new WithinDistanceClause(
    column,
    serializeVector(vector),
    maxDistance,
    metric,
  );
}

export function vectorDistanceField(
  column: string,
  vector: VectorLike,
  options: VectorDistanceFieldOptions = {},
): SelectExpressionField {
  const metric = normalizeMetric(options.metric);
  return {
    alias: options.alias ?? DEFAULT_DISTANCE_ALIAS,
    expression: buildDistanceExpression(column, vector, {
      ...options,
      metric,
    }),
  };
}

export function vectorDistanceOrderBy(
  column: string,
  vector: VectorLike,
  options: VectorOrderByOptions = {},
): OrderByOption {
  const metric = normalizeMetric(options.metric);
  return {
    column: options.columnAlias ?? DEFAULT_DISTANCE_ALIAS,
    direction: options.direction ?? "ASC",
    alias: options.alias,
    nullsPlacement: options.nullsPlacement,
    expression: buildDistanceExpression(column, vector, {
      ...options,
      metric,
    }),
  };
}

export function nearestNeighbor(
  column: string,
  vector: VectorLike,
  options: NearestNeighborOptions = {},
): { field: SelectExpressionField; orderBy: OrderByOption } {
  const alias = options.fieldAlias ?? DEFAULT_DISTANCE_ALIAS;
  return {
    field: vectorDistanceField(column, vector, {
      ...options,
      alias,
    }),
    orderBy: vectorDistanceOrderBy(column, vector, {
      ...options,
      columnAlias: alias,
    }),
  };
}

export function HNSWIndex(options: HNSWIndexOptions): Index {
  const metric = normalizeMetric(options.metric);
  const indexParams: Record<string, string | number | boolean> = {};
  if (options.m !== undefined) {
    validatePositiveInteger(options.m, "m");
    indexParams.m = options.m;
  }
  if (options.efConstruction !== undefined) {
    validatePositiveInteger(options.efConstruction, "efConstruction");
    indexParams.ef_construction = options.efConstruction;
  }
  return {
    name: options.name,
    columns: [options.column],
    indexType: "hnsw",
    ops: {
      [options.column]: getVectorOperatorClass(metric),
    },
    indexParams,
    dbExtension: VECTOR_EXTENSION_NAME,
    concurrently: options.concurrently,
    where: options.where,
  };
}

export function IVFFlatIndex(options: IVFFlatIndexOptions): Index {
  const metric = normalizeMetric(options.metric);
  validatePositiveInteger(options.lists, "lists");
  return {
    name: options.name,
    columns: [options.column],
    indexType: "ivfflat",
    ops: {
      [options.column]: getVectorOperatorClass(metric),
    },
    indexParams: {
      lists: options.lists,
    },
    dbExtension: VECTOR_EXTENSION_NAME,
    concurrently: options.concurrently,
    where: options.where,
  };
}

async function maybeRegisterArrayParser(arrayOID: number) {
  if (!arrayOID || registeredTypeOIDs.has(arrayOID)) {
    return;
  }
  const parseTextArray = pg.types.getTypeParser(1009 as any);
  pg.types.setTypeParser(arrayOID as any, (value: string | null) => {
    if (value === null) {
      return null;
    }
    const parsed = parseTextArray(value) as string[];
    return parsed.map((entry) => parseVectorLiteral(entry));
  });
  registeredTypeOIDs.add(arrayOID);
}

export const pgvectorRuntimeHandler = {
  name: VECTOR_EXTENSION_NAME,
  async initialize(pool: Pick<Pool, "query">) {
    const result = await pool.query<{ oid: number; typarray: number }>(
      "SELECT oid, typarray FROM pg_type WHERE typname = $1 LIMIT 1",
      [VECTOR_TYPE_NAME],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('required pg_type entry "vector" was not found');
    }

    if (!registeredTypeOIDs.has(row.oid)) {
      pg.types.setTypeParser(row.oid as any, (value: string | null) =>
        parseVectorLiteral(value),
      );
      registeredTypeOIDs.add(row.oid);
    }

    await maybeRegisterArrayParser(row.typarray);
  },
};

registerExtensionRuntime(pgvectorRuntimeHandler);
