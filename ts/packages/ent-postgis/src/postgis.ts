import {
  BaseField,
  Clause,
  DBExtension,
  DBType,
  Data,
  Field,
  FieldOptions,
  OrderByOption,
  ParameterizedExpression,
  QueryExpression,
  SelectExpressionField,
  Type,
  registerExtensionRuntime,
} from "@snowtop/ent";
import { types as pgTypes } from "pg";
import type { Pool } from "pg";
import * as wkx from "wkx";

export interface GeoPoint {
  longitude: number;
  latitude: number;
  srid?: number;
}

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number];
}

export type GeoPointInput = GeoPoint | GeoJSONPoint;

type PostGISPointKind = "geography" | "geometry";

export interface PostGISPointFieldOptions extends FieldOptions {
  srid?: number;
}

export interface PostGISExtensionOptions {
  managed?: boolean;
  version?: string;
  installSchema?: string;
  runtimeSchemas?: string[];
  dropCascade?: boolean;
}

export interface PostGISQueryOptions {
  key?: string;
  kind?: PostGISPointKind;
  srid?: number;
}

export function PostGISExtension(
  options: PostGISExtensionOptions = {},
): DBExtension {
  return {
    name: "postgis",
    managed: options.managed !== false,
    version: options.version,
    installSchema: options.installSchema,
    runtimeSchemas: options.runtimeSchemas || ["public"],
    dropCascade: options.dropCascade === true,
  };
}

export function geoPoint(
  longitude: number,
  latitude: number,
  srid = 4326,
): GeoPoint {
  return {
    longitude,
    latitude,
    srid,
  };
}

function isGeoJSONPoint(value: unknown): value is GeoJSONPoint {
  return (
    !!value &&
    typeof value === "object" &&
    (value as GeoJSONPoint).type === "Point" &&
    Array.isArray((value as GeoJSONPoint).coordinates) &&
    (value as GeoJSONPoint).coordinates.length === 2
  );
}

function isGeoPoint(value: unknown): value is GeoPoint {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as GeoPoint).longitude === "number" &&
    typeof (value as GeoPoint).latitude === "number"
  );
}

function getNumber(name: string, value: number) {
  if (!Number.isFinite(value)) {
    throw new Error(`invalid ${name} ${value} for GeoPoint`);
  }
  return value;
}

export function normalizeGeoPoint(
  value: GeoPointInput,
  defaultSrid = 4326,
): GeoPoint {
  if (isGeoPoint(value)) {
    return {
      longitude: getNumber("longitude", value.longitude),
      latitude: getNumber("latitude", value.latitude),
      srid: value.srid ?? defaultSrid,
    };
  }

  if (isGeoJSONPoint(value)) {
    const [longitude, latitude] = value.coordinates;
    return {
      longitude: getNumber("longitude", longitude),
      latitude: getNumber("latitude", latitude),
      srid: defaultSrid,
    };
  }

  throw new Error("expected a GeoPoint or GeoJSON Point value");
}

export function toEWKT(value: GeoPointInput, defaultSrid = 4326): string {
  const point = normalizeGeoPoint(value, defaultSrid);
  const srid = point.srid ?? defaultSrid;
  return `SRID=${srid};POINT(${point.longitude} ${point.latitude})`;
}

function getPointType(kind: PostGISPointKind, srid: number): Type {
  return {
    dbType: DBType.JSONB,
    type: "GeoPoint",
    importType: {
      path: "@snowtop/ent-postgis",
      type: "GeoPoint",
    },
    postgresType: `${kind}(Point,${srid})`,
    dbExtension: "postgis",
  };
}

class PostGISPointField extends BaseField implements Field {
  type: Type;

  constructor(
    private kind: PostGISPointKind,
    private options: PostGISPointFieldOptions = {},
  ) {
    super();
    const srid = this.options.srid ?? 4326;
    this.type = getPointType(this.kind, srid);
    const { srid: _srid, ...fieldOptions } = options;
    Object.assign(this, fieldOptions);
  }

  valid(value: unknown): boolean {
    try {
      normalizeGeoPoint(value as GeoPointInput, this.options.srid ?? 4326);
      return true;
    } catch (err) {
      return false;
    }
  }

  format(value: GeoPointInput): string {
    return toEWKT(value, this.options.srid ?? 4326);
  }
}

export function GeographyPointType(
  options?: PostGISPointFieldOptions,
): PostGISPointField {
  return new PostGISPointField("geography", options);
}

export function GeometryPointType(
  options?: PostGISPointFieldOptions,
): PostGISPointField {
  return new PostGISPointField("geometry", options);
}

function getColumnReference(column: string, alias?: string) {
  return alias ? `${alias}.${column}` : column;
}

function getPointSQL(kind: PostGISPointKind, idx: number) {
  if (kind === "geometry") {
    return `ST_GeomFromEWKT($${idx})`;
  }
  return `ST_GeogFromText($${idx})`;
}

function getDistanceKey(
  prefix: string,
  column: string,
  point: GeoPoint,
  extra?: number,
  kind: PostGISPointKind = "geography",
) {
  return [
    "postgis",
    prefix,
    kind,
    column,
    point.longitude,
    point.latitude,
    point.srid ?? 4326,
    extra,
  ]
    .filter((entry) => entry !== undefined)
    .join(":");
}

class PostGISClause<T extends Data, K = keyof T> implements Clause<T, K> {
  constructor(
    private key: string,
    private column: K,
    private render: (idx: number, alias?: string) => string,
    private params: any[],
  ) {}

  clause(idx: number, alias?: string): string {
    return this.render(idx, alias);
  }

  columns(): K[] {
    return [this.column];
  }

  values(): any[] {
    return this.params;
  }

  logValues(): any[] {
    return this.params;
  }

  instanceKey(): string {
    return this.key;
  }
}

export function distance(
  column: string,
  point: GeoPointInput,
  options: PostGISQueryOptions = {},
): QueryExpression {
  const normalized = normalizeGeoPoint(point, options.srid ?? 4326);
  const ewkt = toEWKT(normalized, options.srid ?? 4326);
  const kind = options.kind ?? "geography";
  return ParameterizedExpression(
    options.key || getDistanceKey("distance", column, normalized, undefined, kind),
    (idx, alias) =>
      `ST_Distance(${getColumnReference(column, alias)}, ${getPointSQL(kind, idx)})`,
    [ewkt],
  );
}

export function selectDistance(
  alias: string,
  column: string,
  point: GeoPointInput,
  options: PostGISQueryOptions = {},
): SelectExpressionField {
  return {
    alias,
    expression: distance(column, point, options),
  };
}

export function orderByDistance(
  column: string,
  point: GeoPointInput,
  direction: "ASC" | "DESC" = "ASC",
  options: PostGISQueryOptions & {
    alias?: string;
    nullsPlacement?: "first" | "last";
  } = {},
): OrderByOption {
  return {
    column: options.alias || "distance",
    direction,
    expression: distance(column, point, options),
    nullsPlacement: options.nullsPlacement,
  };
}

export function dWithin<T extends Data, K = keyof T>(
  column: K,
  point: GeoPointInput,
  distanceValue: number,
  options: PostGISQueryOptions = {},
): Clause<T, K> {
  const normalized = normalizeGeoPoint(point, options.srid ?? 4326);
  const ewkt = toEWKT(normalized, options.srid ?? 4326);
  const kind = options.kind ?? "geography";
  return new PostGISClause<T, K>(
    options.key ||
      getDistanceKey(
        "dwithin",
        `${column as string}`,
        normalized,
        distanceValue,
        kind,
      ),
    column,
    (idx, alias) =>
      `ST_DWithin(${getColumnReference(column as string, alias)}, ${getPointSQL(
        kind,
        idx,
      )}, $${idx + 1})`,
    [ewkt, distanceValue],
  );
}

export function pointGISTIndex(name: string, column: string) {
  return {
    name,
    columns: [column],
    indexType: "gist",
    dbExtension: "postgis",
  };
}

function isHexEncodedGeometry(value: string) {
  const trimmed = value.startsWith("\\x") ? value.slice(2) : value;
  return trimmed.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(trimmed);
}

function fromWKXGeometry(geometry: wkx.Geometry): any {
  if (geometry instanceof wkx.Point) {
    return {
      longitude: geometry.x,
      latitude: geometry.y,
      srid: geometry.srid,
    } satisfies GeoPoint;
  }
  return geometry.toGeoJSON();
}

export function parsePostGISValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "object" && !Buffer.isBuffer(value)) {
    return value;
  }

  let geometry: wkx.Geometry;
  if (Buffer.isBuffer(value)) {
    geometry = wkx.Geometry.parse(value);
    return fromWKXGeometry(geometry);
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  if (isHexEncodedGeometry(trimmed)) {
    const hex = trimmed.startsWith("\\x") ? trimmed.slice(2) : trimmed;
    geometry = wkx.Geometry.parse(Buffer.from(hex, "hex"));
    return fromWKXGeometry(geometry);
  }

  geometry = wkx.Geometry.parse(trimmed);
  return fromWKXGeometry(geometry);
}

export async function initializePostGISParsers(pool: Pick<Pool, "query">) {
  const res = await pool.query<{ oid: number; typname: string }>(
    `
      SELECT t.oid, t.typname
      FROM pg_catalog.pg_type AS t
      WHERE t.typname = ANY($1::text[])
    `,
    [["geometry", "geography"]],
  );

  for (const row of res.rows) {
    pgTypes.setTypeParser(Number(row.oid), (value: string) => parsePostGISValue(value));
  }
}

let registeredRuntime = false;

export function registerPostGISRuntime() {
  if (registeredRuntime) {
    return;
  }
  registerExtensionRuntime({
    name: "postgis",
    initialize: initializePostGISParsers,
  });
  registeredRuntime = true;
}

registerPostGISRuntime();
