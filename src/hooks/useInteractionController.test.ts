import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInteractionController } from './useInteractionController';
import type { InteractionProvider, Viewer } from '../types/provider';
import { DEFAULT_PERFORMANCE_CONFIG } from '../types/config';
import type { SentenceStats } from '../types/model';

const viewer: Viewer = { id: 'user-1' };
const bookId = 'book-1';

const makeStats = (id: string, liked = false): SentenceStats => ({
    sentenceId: id,
    likesCount: 5,
    commentsCount: 2,
    likedByMe: liked,
});

const makeProvider = (overrides?: Partial<InteractionProvider>): InteractionProvider => ({
    getSentenceStats: vi.fn().mockResolvedValue({ s1: makeStats('s1') }),
    toggleLikeSentence: vi.fn().mockResolvedValue({ sentenceId: 's1', likedByMe: true, likesCount: 6 }),
    listComments: vi.fn().mockResolvedValue([]),
    addComment: vi.fn().mockResolvedValue({}),
    deleteComment: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
});

const performance = { ...DEFAULT_PERFORMANCE_CONFIG };

describe('useInteractionController', () => {
    let provider: InteractionProvider;
    let onRequireLogin: ReturnType<typeof vi.fn<(reason: string) => void>>;

    beforeEach(() => {
        provider = makeProvider();
        onRequireLogin = vi.fn<(reason: string) => void>();
    });

    it('toggleLike applies optimistic update immediately', async () => {
        const { result } = renderHook(() =>
            useInteractionController({ bookId, interactionProvider: provider, viewer, performance, onRequireLogin })
        );

        // Seed stats first via prefetchStats
        await act(async () => {
            result.current.prefetchStats(['s1']);
            // Wait for scheduler (the scheduler is async, need to flush)
            await new Promise(r => setTimeout(r, 200));
        });

        await act(async () => {
            await result.current.toggleLike('s1');
        });

        const stats = result.current.getStats('s1');
        expect(stats?.likedByMe).toBe(true);
        expect(stats?.likesCount).toBe(6);
    });

    it('toggleLike rolls back on server failure', async () => {
        (provider.toggleLikeSentence as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const { result } = renderHook(() =>
            useInteractionController({ bookId, interactionProvider: provider, viewer, performance, onRequireLogin })
        );

        await act(async () => {
            await result.current.toggleLike('s1');
        });

        // Should rollback to defaults (no prior cache entry)
        const stats = result.current.getStats('s1');
        expect(stats?.likedByMe).toBe(false);
    });

    it('toggleLike calls onRequireLogin when viewer is undefined', async () => {
        const { result } = renderHook(() =>
            useInteractionController({
                bookId,
                interactionProvider: provider,
                viewer: undefined,
                performance,
                onRequireLogin,
            })
        );

        await act(async () => {
            await result.current.toggleLike('s1');
        });

        expect(onRequireLogin).toHaveBeenCalledWith('like');
        expect(provider.toggleLikeSentence).not.toHaveBeenCalled();
    });

    it('updateCommentCount adjusts only the commentsCount field', async () => {
        const { result } = renderHook(() =>
            useInteractionController({ bookId, interactionProvider: provider, viewer, performance })
        );

        // Seed stats
        await act(async () => {
            result.current.prefetchStats(['s1']);
            await new Promise(r => setTimeout(r, 200));
        });

        act(() => {
            result.current.updateCommentCount('s1', 3);
        });

        const stats = result.current.getStats('s1');
        expect(stats?.commentsCount).toBe(5); // 2 + 3
        expect(stats?.likesCount).toBe(5); // unchanged
    });

    it('getStats returns undefined for uncached IDs', () => {
        const { result } = renderHook(() =>
            useInteractionController({ bookId, interactionProvider: provider, viewer, performance })
        );

        expect(result.current.getStats('unknown-id')).toBeUndefined();
    });

    it('calls onError with stats scope when toggleLike fails', async () => {
        (provider.toggleLikeSentence as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('like-fail'));
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const onError = vi.fn<(err: unknown, context: { scope: 'content' | 'stats' | 'comments' }) => void>();

        const { result } = renderHook(() =>
            useInteractionController({ bookId, interactionProvider: provider, viewer, performance, onError })
        );

        await act(async () => {
            await result.current.toggleLike('s1');
        });

        expect(onError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ scope: 'stats' })
        );
    });
});
