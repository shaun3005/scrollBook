import type { InteractionProvider, Viewer } from '../types/provider';
import type { PerformanceConfig } from '../types/config';
import type { BookId, SentenceId, SentenceStats } from '../types/model';
import { useState, useRef, useEffect, useCallback } from 'react';
import { BatchScheduler } from '../lib/BatchScheduler';

export interface UseInteractionControllerProps {
    bookId: BookId;
    interactionProvider: InteractionProvider;
    viewer?: Viewer;
    performance: PerformanceConfig;
    onRequireLogin?: (reason: string) => void;
    onError?: (err: unknown, context: { scope: 'content' | 'stats' | 'comments' }) => void;
}

export const useInteractionController = ({
    bookId,
    interactionProvider,
    viewer,
    performance,
    onRequireLogin,
    onError,
}: UseInteractionControllerProps) => {
    const [statsMap, setStatsMap] = useState<Record<SentenceId, { data: SentenceStats; fetchedAt: number }>>({});

    const schedulerRef = useRef<BatchScheduler | null>(null);

    useEffect(() => {

        if (schedulerRef.current) {
            schedulerRef.current.destroy();
        }

        schedulerRef.current = new BatchScheduler(
            { batchSize: performance.batchSize, debounceMs: performance.debounceMs },
            async (ids) => {
                return interactionProvider.getSentenceStats({
                    bookId,
                    sentenceIds: ids,
                    viewer
                });
            }
        );


        return () => {
            if (schedulerRef.current) {
                schedulerRef.current.destroy();
                schedulerRef.current = null;
            }
        };
    }, [bookId, interactionProvider, viewer, performance.batchSize, performance.debounceMs]);

    const getStats = useCallback((sentenceId: SentenceId): SentenceStats | undefined => {
        return statsMap[sentenceId]?.data;
    }, [statsMap]);

    const prefetchStats = useCallback((ids: SentenceId[]) => {
        ids.forEach(id => {
            // Only schedule if not already in recent cache to save scheduler overhead

            const cached = statsMap[id];
            const now = Date.now();
            const ttl = performance.cacheTtlMs || 60_000;

            if (cached && (now - cached.fetchedAt < ttl)) {
                return; // Already valid
            }

            schedulerRef.current?.schedule(id, (newStats) => {
                setStatsMap(prev => ({
                    ...prev,
                    [newStats.sentenceId]: { data: newStats, fetchedAt: Date.now() }
                }));
            });
        });
    }, [statsMap, performance.cacheTtlMs]);

    const toggleLike = async (sentenceId: SentenceId) => {
        if (!viewer) {
            onRequireLogin?.('like');
            return;
        }

        // 1. Optimistic Update
        const currentEntry = statsMap[sentenceId];
        const current = currentEntry?.data || {
            sentenceId, likesCount: 0, commentsCount: 0, likedByMe: false
        };

        const wasLiked = current.likedByMe;
        const optimistic: SentenceStats = {
            ...current,
            likedByMe: !wasLiked,
            likesCount: Math.max(0, current.likesCount + (wasLiked ? -1 : 1))
        };

        // Update with current timestamp to prevent immediate eviction/refetch
        setStatsMap(prev => ({
            ...prev,
            [sentenceId]: { data: optimistic, fetchedAt: Date.now() }
        }));

        try {
            // 2. Network Call
            const result = await interactionProvider.toggleLikeSentence({
                bookId,
                sentenceId,
                viewer
            });

            // 3. Reconcile (use server result if available)
            setStatsMap(prev => ({
                ...prev,
                [sentenceId]: {
                    data: {
                        ...prev[sentenceId]?.data, // use latest from state
                        likedByMe: result.likedByMe,
                        likesCount: result.likesCount ?? optimistic.likesCount
                    },
                    fetchedAt: Date.now()
                }
            }));
        } catch (e) {
            // 4. Rollback
            setStatsMap(prev => ({
                ...prev,
                [sentenceId]: currentEntry || { data: current, fetchedAt: Date.now() } // fallback
            }));
            console.error('Like toggle failed', e);
            onError?.(e, { scope: 'stats' });
        }
    };

    const updateCommentCount = useCallback((sentenceId: SentenceId, delta: number) => {
        setStatsMap(prev => {
            const currentEntry = prev[sentenceId];
            if (!currentEntry) return prev; // If not in cache, nothing to update (will be fetched when visible)

            const currentData = currentEntry.data;
            const newCount = Math.max(0, currentData.commentsCount + delta);

            if (newCount === currentData.commentsCount) return prev;

            return {
                ...prev,
                [sentenceId]: {
                    ...currentEntry,
                    data: {
                        ...currentData,
                        commentsCount: newCount
                    }
                }
            };
        });
    }, []);

    return {
        getStats,
        toggleLike,
        prefetchStats,
        updateCommentCount,
    };
};
