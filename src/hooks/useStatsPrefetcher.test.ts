import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStatsPrefetcher } from './useStatsPrefetcher';
import type { ContentChunk, SentenceId } from '../types/model';
import { DEFAULT_PERFORMANCE_CONFIG } from '../types/config';

const makeChunk = (ids: string[]): ContentChunk => ({
    bookId: 'book-1',
    items: ids.map(id => ({
        sentenceId: id,
        text: `Text for ${id}`,
        bookTitle: 'Test Book',
        chapterTitle: 'Ch 1',
        author: 'Author',
    })),
    nextCursor: null,
});

describe('useStatsPrefetcher', () => {
    const performance = {
        ...DEFAULT_PERFORMANCE_CONFIG,
        prefetchAhead: 2,
        prefetchBehind: 1,
    };

    it('calculates correct prefetch range around visible items', () => {
        const prefetchStats = vi.fn();
        const chunks = [makeChunk(['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'])];
        const visibleSentenceIds: SentenceId[] = ['s3'];

        renderHook(() =>
            useStatsPrefetcher({ visibleSentenceIds, chunks, performance, prefetchStats })
        );

        // visible=3, behind=1 → start=2, ahead=2 → end=5
        expect(prefetchStats).toHaveBeenCalledWith(
            expect.arrayContaining(['s2', 's3', 's4', 's5'])
        );
        expect(prefetchStats.mock.calls[0][0]).toHaveLength(4);
    });

    it('clamps startIdx to 0 when visible item is near the beginning', () => {
        const prefetchStats = vi.fn();
        const chunks = [makeChunk(['s0', 's1', 's2', 's3', 's4'])];
        const visibleSentenceIds: SentenceId[] = ['s0'];

        renderHook(() =>
            useStatsPrefetcher({ visibleSentenceIds, chunks, performance, prefetchStats })
        );

        // visible=0, behind=1 → start = max(0, -1) = 0
        const called = prefetchStats.mock.calls[0][0] as string[];
        expect(called[0]).toBe('s0');
        expect(called).not.toContain('s-1');
    });

    it('clamps endIdx to array length when visible item is near the end', () => {
        const prefetchStats = vi.fn();
        const chunks = [makeChunk(['s0', 's1', 's2'])];
        const visibleSentenceIds: SentenceId[] = ['s2'];

        renderHook(() =>
            useStatsPrefetcher({ visibleSentenceIds, chunks, performance, prefetchStats })
        );

        const called = prefetchStats.mock.calls[0][0] as string[];
        expect(called[called.length - 1]).toBe('s2');
    });

    it('does not call prefetchStats when visibleSentenceIds is empty', () => {
        const prefetchStats = vi.fn();
        const chunks = [makeChunk(['s0', 's1'])];

        renderHook(() =>
            useStatsPrefetcher({ visibleSentenceIds: [], chunks, performance, prefetchStats })
        );

        expect(prefetchStats).not.toHaveBeenCalled();
    });
});
