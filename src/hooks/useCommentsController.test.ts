import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommentsController } from './useCommentsController';
import type { InteractionProvider, Viewer } from '../types/provider';
import type { Comment } from '../types/model';

const viewer: Viewer = { id: 'user-1' };
const bookId = 'book-1';
const sentenceId = 'sent-1';

const mockComment: Comment = {
    id: 'c1',
    sentenceId,
    userId: 'user-1',
    username: 'TestUser',
    content: 'Great sentence!',
    isPublic: true,
    createdAt: new Date().toISOString(),
};

const makeProvider = (overrides?: Partial<InteractionProvider>): InteractionProvider => ({
    getSentenceStats: vi.fn().mockResolvedValue({}),
    toggleLikeSentence: vi.fn().mockResolvedValue({ sentenceId, likedByMe: true }),
    listComments: vi.fn().mockResolvedValue([mockComment]),
    addComment: vi.fn().mockResolvedValue(mockComment),
    deleteComment: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
});

describe('useCommentsController', () => {
    let provider: InteractionProvider;
    let onCommentCountChange: ReturnType<typeof vi.fn<(sentenceId: string, delta: number) => void>>;
    let onRequireLogin: ReturnType<typeof vi.fn<(reason: string) => void>>;

    beforeEach(() => {
        provider = makeProvider();
        onCommentCountChange = vi.fn<(sentenceId: string, delta: number) => void>();
        onRequireLogin = vi.fn<(reason: string) => void>();
    });

    it('openDrawer fetches comments and sets isOpen to true', async () => {
        const { result } = renderHook(() =>
            useCommentsController({ bookId, interactionProvider: provider, viewer, onCommentCountChange })
        );

        await act(async () => {
            await result.current.openDrawer(sentenceId);
        });

        expect(result.current.isOpen).toBe(true);
        expect(result.current.activeSentenceId).toBe(sentenceId);
        expect(result.current.comments).toEqual([mockComment]);
        expect(provider.listComments).toHaveBeenCalledWith({ bookId, sentenceId, viewer });
    });

    it('closeDrawer resets all state', async () => {
        const { result } = renderHook(() =>
            useCommentsController({ bookId, interactionProvider: provider, viewer, onCommentCountChange })
        );

        await act(async () => { await result.current.openDrawer(sentenceId); });
        act(() => { result.current.closeDrawer(); });

        expect(result.current.isOpen).toBe(false);
        expect(result.current.activeSentenceId).toBeNull();
        expect(result.current.comments).toEqual([]);
    });

    it('addComment calls provider and prepends to comments', async () => {
        const newComment = { ...mockComment, id: 'c2', content: 'New one' };
        (provider.addComment as ReturnType<typeof vi.fn>).mockResolvedValue(newComment);

        const { result } = renderHook(() =>
            useCommentsController({ bookId, interactionProvider: provider, viewer, onCommentCountChange })
        );

        await act(async () => { await result.current.openDrawer(sentenceId); });
        await act(async () => { await result.current.addComment('New one', true); });

        expect(onCommentCountChange).toHaveBeenCalledWith(sentenceId, 1);
        expect(result.current.comments[0]).toEqual(newComment);
    });

    it('addComment rolls back count on provider failure', async () => {
        (provider.addComment as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const { result } = renderHook(() =>
            useCommentsController({ bookId, interactionProvider: provider, viewer, onCommentCountChange })
        );

        await act(async () => { await result.current.openDrawer(sentenceId); });
        await act(async () => { await result.current.addComment('fail', true); });

        // Optimistic +1, then rollback -1
        expect(onCommentCountChange).toHaveBeenCalledWith(sentenceId, 1);
        expect(onCommentCountChange).toHaveBeenCalledWith(sentenceId, -1);
    });

    it('addComment triggers onRequireLogin when viewer is undefined', async () => {
        const { result } = renderHook(() =>
            useCommentsController({
                bookId,
                interactionProvider: provider,
                viewer: undefined,
                onRequireLogin,
                onCommentCountChange,
            })
        );

        await act(async () => { await result.current.addComment('test', true); });

        expect(onRequireLogin).toHaveBeenCalledWith('comment');
        expect(provider.addComment).not.toHaveBeenCalled();
    });

    it('deleteComment removes comment from list on success', async () => {
        const { result } = renderHook(() =>
            useCommentsController({ bookId, interactionProvider: provider, viewer, onCommentCountChange })
        );

        await act(async () => { await result.current.openDrawer(sentenceId); });
        await act(async () => { await result.current.deleteComment('c1'); });

        expect(result.current.comments).toEqual([]);
        expect(onCommentCountChange).toHaveBeenCalledWith(sentenceId, -1);
    });

    it('deleteComment rolls back count on provider failure', async () => {
        (provider.deleteComment as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const { result } = renderHook(() =>
            useCommentsController({ bookId, interactionProvider: provider, viewer, onCommentCountChange })
        );

        await act(async () => { await result.current.openDrawer(sentenceId); });
        await act(async () => { await result.current.deleteComment('c1'); });

        // Optimistic -1, then rollback +1
        expect(onCommentCountChange).toHaveBeenCalledWith(sentenceId, -1);
        expect(onCommentCountChange).toHaveBeenCalledWith(sentenceId, 1);
    });

    it('calls onError with comments scope when addComment fails', async () => {
        (provider.addComment as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('add-fail'));
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const onError = vi.fn<(err: unknown, context: { scope: 'content' | 'stats' | 'comments' }) => void>();

        const { result } = renderHook(() =>
            useCommentsController({ bookId, interactionProvider: provider, viewer, onCommentCountChange, onError })
        );

        await act(async () => { await result.current.openDrawer(sentenceId); });
        await act(async () => { await result.current.addComment('fail', true); });

        expect(onError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ scope: 'comments' })
        );
    });

    it('calls onError with comments scope when deleteComment fails', async () => {
        (provider.deleteComment as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('del-fail'));
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const onError = vi.fn<(err: unknown, context: { scope: 'content' | 'stats' | 'comments' }) => void>();

        const { result } = renderHook(() =>
            useCommentsController({ bookId, interactionProvider: provider, viewer, onCommentCountChange, onError })
        );

        await act(async () => { await result.current.openDrawer(sentenceId); });
        await act(async () => { await result.current.deleteComment('c1'); });

        expect(onError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ scope: 'comments' })
        );
    });

    it('calls onError with comments scope when openDrawer fetch fails', async () => {
        (provider.listComments as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('list-fail'));
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const onError = vi.fn<(err: unknown, context: { scope: 'content' | 'stats' | 'comments' }) => void>();

        const { result } = renderHook(() =>
            useCommentsController({ bookId, interactionProvider: provider, viewer, onError })
        );

        await act(async () => { await result.current.openDrawer(sentenceId); });

        expect(onError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ scope: 'comments' })
        );
    });
});
