export type PerformanceConfig = {
    batchSize: number;
    debounceMs: number;
    prefetchAhead: number;
    prefetchBehind: number;
    cacheTtlMs: number;

    initialLoadSize: number;
    chunkLoadSize: number;
    bufferAhead: number;
    bufferBehind: number;
};

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
    batchSize: 30,
    debounceMs: 100,
    prefetchAhead: 10,
    prefetchBehind: 5,
    cacheTtlMs: 60_000,
    initialLoadSize: 5,
    chunkLoadSize: 5,
    bufferAhead: 10,
    bufferBehind: 5,
};
