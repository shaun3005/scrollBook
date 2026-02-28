import { useEffect } from 'react';
import type { SentenceId, ContentChunk } from '../types/model';
import type { PerformanceConfig } from '../types/config';

type PrefetcherProps = {
    visibleSentenceIds: SentenceId[];
    chunks: ContentChunk[];
    performance: PerformanceConfig;
    prefetchStats: (ids: SentenceId[]) => void;
};

export const useStatsPrefetcher = ({
    visibleSentenceIds,
    chunks,
    performance,
    prefetchStats
}: PrefetcherProps) => {
    useEffect(() => {
        if (visibleSentenceIds.length === 0 || !chunks.length) return;

        const allItems = chunks.flatMap(c => c.items);

        const visibleIndices = visibleSentenceIds
            .map(id => allItems.findIndex(item => item.sentenceId === id))
            .filter(idx => idx !== -1)
            .sort((a, b) => a - b);

        if (visibleIndices.length === 0) return;


        const firstVisible = visibleIndices[0];
        const lastVisible = visibleIndices[visibleIndices.length - 1];

        const startIdx = Math.max(0, firstVisible - performance.prefetchBehind);
        const endIdx = Math.min(allItems.length - 1, lastVisible + performance.prefetchAhead);

        const idsToPrefetch = new Set<SentenceId>();

        for (let i = startIdx; i <= endIdx; i++) {
            idsToPrefetch.add(allItems[i].sentenceId);
        }

        if (idsToPrefetch.size > 0) {
            prefetchStats(Array.from(idsToPrefetch));
        }

    }, [visibleSentenceIds, chunks, performance.prefetchAhead, performance.prefetchBehind, prefetchStats]);
};
