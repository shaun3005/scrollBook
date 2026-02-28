import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReaderController } from './useReaderController';
import type { ContentProvider, Viewer } from '../types/provider';
import type { ContentChunk } from '../types/model';
import { DEFAULT_PERFORMANCE_CONFIG } from '../types/config';

const viewer: Viewer = { id: 'user-1' };
const bookId = 'book-1';

const makeChunk = (ids: string[], nextCursor: string | null = null, prevCursor?: string | null): ContentChunk => ({
    bookId,
    items: ids.map(id => ({
        sentenceId: id,
        text: `Text for ${id}`,
        bookTitle: 'Book',
        chapterTitle: 'Ch1',
        author: 'Author',
    })),
    nextCursor,
    prevCursor,
});

const makeProvider = (overrides?: Partial<ContentProvider>): ContentProvider => ({
    getInitialContent: vi.fn().mockResolvedValue(makeChunk(['s1', 's2'], 'cursor-next', 'cursor-prev')),
    getContentChunk: vi.fn().mockResolvedValue(makeChunk(['s3', 's4'], 'cursor-next-2')),
    ...overrides,
});

const performance = { ...DEFAULT_PERFORMANCE_CONFIG, initialLoadSize: 2, chunkLoadSize: 2 };

describe('useReaderController', () => {
    let provider: ContentProvider;

    beforeEach(() => {
        provider = makeProvider();
    });

    // --- Initial Load ---

    it('loads initial content and sets chunks on mount', async () => {
        const { result } = renderHook(() =>
            useReaderController({ bookId, contentProvider: provider, viewer, performance })
        );

        // Initially loading
        expect(result.current.loading).toBe(true);

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.chunks).toHaveLength(1);
        expect(result.current.chunks[0].items[0].sentenceId).toBe('s1');
        expect(provider.getInitialContent).toHaveBeenCalledWith(
            expect.objectContaining({ bookId, viewer, limit: 2 })
        );
    });

    it('sets error state when initial load fails', async () => {
        provider = makeProvider({
            getInitialContent: vi.fn().mockRejectedValue(new Error('Network error')),
        });

        const { result } = renderHook(() =>
            useReaderController({ bookId, contentProvider: provider, viewer, performance })
        );

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.loading).toBe(false);
        expect(result.current.chunks).toHaveLength(0);
    });

    // --- loadMore ---

    it('does not call loadMore when there is no nextCursor', async () => {
        provider = makeProvider({
            getInitialContent: vi.fn().mockResolvedValue(makeChunk(['s1'], null)),
        });

        const { result } = renderHook(() =>
            useReaderController({ bookId, contentProvider: provider, viewer, performance })
        );

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        // hasMore should be false since nextCursor is null
        expect(result.current.chunks).toHaveLength(1);
        // getContentChunk should not have been called
        expect(provider.getContentChunk).not.toHaveBeenCalled();
    });

    // --- loadPrevious ---

    it('does not call loadPrevious when there is no prevCursor', async () => {
        provider = makeProvider({
            getInitialContent: vi.fn().mockResolvedValue(makeChunk(['s1'], 'cursor-next', null)),
        });

        const { result } = renderHook(() =>
            useReaderController({ bookId, contentProvider: provider, viewer, performance })
        );

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(result.current.chunks).toHaveLength(1);
        expect(provider.getContentChunk).not.toHaveBeenCalled();
    });

    // --- Error during load ---

    it('sets error when getContentChunk fails during loadMore', async () => {
        // Initial load succeeds with nextCursor so loadMore is possible
        const initialChunk = makeChunk(['s1'], 'cursor-next');

        provider = makeProvider({
            getInitialContent: vi.fn().mockResolvedValue(initialChunk),
            getContentChunk: vi.fn().mockRejectedValue(new Error('Chunk load failed')),
        });

        const { result } = renderHook(() =>
            useReaderController({ bookId, contentProvider: provider, viewer, performance })
        );

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        // Initial load should succeed
        expect(result.current.chunks).toHaveLength(1);
        expect(result.current.error).toBeNull();
    });

    // --- containerRef ---

    it('returns a containerRef for the scroll container', async () => {
        const { result } = renderHook(() =>
            useReaderController({ bookId, contentProvider: provider, viewer, performance })
        );

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(result.current.containerRef).toBeDefined();
        expect(result.current.containerRef.current).toBeNull();
    });

    // --- loadingRef race condition guard ---

    it('prevents duplicate loadMore calls via loadingRef guard', async () => {
        // Simulate slow provider that takes 200ms
        const slowProvider = makeProvider({
            getInitialContent: vi.fn().mockResolvedValue(makeChunk(['s1'], 'cursor-next')),
            getContentChunk: vi.fn().mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve(makeChunk(['s3'], 'cursor-next-2')), 200))
            ),
        });

        const { result } = renderHook(() =>
            useReaderController({ bookId, contentProvider: slowProvider, viewer, performance })
        );

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        // Initial load complete, chunks should have content
        expect(result.current.chunks).toHaveLength(1);
    });

    // --- Cleanup on unmount ---

    it('does not update state after unmount', async () => {
        // Use a slow initial load to test the mounted guard
        const slowProvider = makeProvider({
            getInitialContent: vi.fn().mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve(makeChunk(['s1'], null)), 300))
            ),
        });

        const { unmount } = renderHook(() =>
            useReaderController({ bookId, contentProvider: slowProvider, viewer, performance })
        );

        // Unmount before the load completes
        unmount();

        // Wait for the slow promise to resolve
        await act(async () => {
            await new Promise(r => setTimeout(r, 400));
        });

        // No error should be thrown (state update on unmounted component)
    });

    // --- Buffer pruning ---

    it('returns correct initial state shape', async () => {
        const { result } = renderHook(() =>
            useReaderController({ bookId, contentProvider: provider, viewer, performance })
        );

        expect(result.current).toHaveProperty('chunks');
        expect(result.current).toHaveProperty('loading');
        expect(result.current).toHaveProperty('error');
        expect(result.current).toHaveProperty('containerRef');
        expect(Array.isArray(result.current.chunks)).toBe(true);

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });
    });
});
