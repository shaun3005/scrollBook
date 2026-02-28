import { useState } from 'react';
import type { InteractionProvider, Viewer } from '../types/provider';
import type { BookId, SentenceId, Comment } from '../types/model';

export interface UseCommentsControllerProps {
    bookId: BookId;
    interactionProvider: InteractionProvider;
    viewer?: Viewer;
    onRequireLogin?: (reason: string) => void;
    onCommentCountChange?: (sentenceId: SentenceId, delta: number) => void;
    onError?: (err: unknown, context: { scope: 'content' | 'stats' | 'comments' }) => void;
}

export const useCommentsController = ({
    bookId,
    interactionProvider,
    viewer,
    onRequireLogin,
    onCommentCountChange,
    onError,
}: UseCommentsControllerProps) => {
    const [activeSentenceId, setActiveSentenceId] = useState<SentenceId | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const openDrawer = async (sentenceId: SentenceId) => {
        setActiveSentenceId(sentenceId);
        setIsOpen(true);
        setLoading(true);

        try {
            const list = await interactionProvider.listComments({ bookId, sentenceId, viewer });
            setComments([...list]);
        } catch (e) {
            console.error(e);
            onError?.(e, { scope: 'comments' });
        } finally {
            setLoading(false);
        }
    };

    const closeDrawer = () => {
        setIsOpen(false);
        setActiveSentenceId(null);
        setComments([]);
    };

    const addComment = async (content: string, isPublic: boolean) => {
        if (!viewer) {
            onRequireLogin?.('comment');
            return;
        }
        if (!activeSentenceId) return;

        onCommentCountChange?.(activeSentenceId, 1);

        try {
            const newComment = await interactionProvider.addComment({
                bookId,
                sentenceId: activeSentenceId,
                content,
                isPublic,
                viewer
            });
            setComments(prev => [newComment, ...prev]);
        } catch (e) {
            console.error(e);
            onError?.(e, { scope: 'comments' });
            // Rollback
            onCommentCountChange?.(activeSentenceId, -1);
        }
    };

    const deleteComment = async (commentId: string) => {
        if (!viewer) {
            onRequireLogin?.('comment');
            return;
        }

        if (!interactionProvider.deleteComment) {
            console.warn('interactionProvider.deleteComment is not implemented');
            return;
        }

        // Optimistic Update
        if (activeSentenceId) {
            onCommentCountChange?.(activeSentenceId, -1);
        }

        try {
            const { success } = await interactionProvider.deleteComment({
                bookId,
                commentId,
                viewer
            });

            if (success) {
                setComments(prev => prev.filter(c => c.id !== commentId));
            } else {
                if (activeSentenceId) onCommentCountChange?.(activeSentenceId, 1);
            }
        } catch (e) {
            console.error('Failed to delete comment:', e);
            onError?.(e, { scope: 'comments' });
            if (activeSentenceId) onCommentCountChange?.(activeSentenceId, 1);
        }
    };

    return {
        isOpen,
        activeSentenceId,
        comments,
        loading,
        openDrawer,
        closeDrawer,
        addComment,
        deleteComment
    };
};
