export type DataLoaderBatchMetrics = {
  loaderName: string;
  batchSize: number;
};

export type DataLoaderCacheHitMetrics = {
  tableName: string;
  key: unknown;
};

export type QueryCacheHitMetrics = {
  tableName: string;
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
