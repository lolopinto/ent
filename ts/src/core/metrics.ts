export type DataLoaderBatchMetrics = {
  // Built-in loaders use stable structural labels. Custom callers must exclude
  // query values; this label is emitted without redaction.
  loaderName: string;
  // Opaque logical loader identity, stable only within this process. Use for
  // debugging/correlation, not as a metric label (potentially high cardinality).
  // Optional for compatibility and when a dynamic clause lacks an instanceKey.
  loaderId?: string;
  batchSize: number;
};

export type DataLoaderCacheHitMetrics = {
  tableName: string;
  // Ent emits an opaque process-local string. Keep unknown for compatibility
  // with existing producers of this public metrics type.
  key: unknown;
};

export type QueryCacheHitMetrics = {
  tableName: string;
  // Opaque process-local cache identity.
  key: string;
};

export type MetricsHook = {
  onDataLoaderBatch?: (info: DataLoaderBatchMetrics) => void;
  onDataLoaderCacheHit?: (info: DataLoaderCacheHitMetrics) => void;
  onQueryCacheHit?: (info: QueryCacheHitMetrics) => void;
};

let onDataLoaderBatch: MetricsHook["onDataLoaderBatch"];
let onDataLoaderCacheHit: MetricsHook["onDataLoaderCacheHit"];
let onQueryCacheHit: MetricsHook["onQueryCacheHit"];

export function setMetricsHook(hooks?: MetricsHook | null): void {
  onDataLoaderBatch = hooks?.onDataLoaderBatch;
  onDataLoaderCacheHit = hooks?.onDataLoaderCacheHit;
  onQueryCacheHit = hooks?.onQueryCacheHit;
}

export function getMetricsHook(): MetricsHook {
  return {
    onDataLoaderBatch,
    onDataLoaderCacheHit,
    onQueryCacheHit,
  };
}

export function getOnDataLoaderBatch() {
  return onDataLoaderBatch;
}

export function getOnDataLoaderCacheHit() {
  return onDataLoaderCacheHit;
}

export function getOnQueryCacheHit() {
  return onQueryCacheHit;
}
