import type { ContentProvider, Viewer } from '../types/provider';
import type { PerformanceConfig } from '../types/config';
import type { BookId, ContentChunk, ContentCursor } from '../types/model';
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';

export interface UseReaderControllerProps {
    bookId: BookId;
    contentProvider: ContentProvider;
    viewer?: Viewer;
    performance: PerformanceConfig;
}

export const useReaderController = ({
    bookId,
    contentProvider,
    viewer,
    performance,
}: UseReaderControllerProps) => {
    const [chunks, setChunks] = useState<ContentChunk[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<unknown>(null);

    // Ref for the scroll container to detect bottom
    const containerRef = useRef<HTMLDivElement>(null);

    // Cursor tracking
    const nextCursorRef = useRef<ContentCursor | null>(null);
    const prevCursorRef = useRef<ContentCursor | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [hasPrev, setHasPrev] = useState(false);

    // Ref-based loading guard: prevents race conditions where rapid scrolling triggers
    // loadMore/loadPrevious before React's async state update has flipped loading=true.
    const loadingRef = useRef(false);

    // Initial Load
    useEffect(() => {
        let mounted = true;
        const loadInitial = async () => {
            setLoading(true);
            setError(null);
            try {
                const chunk = await contentProvider.getInitialContent({
                    bookId,
                    limit: performance.initialLoadSize || 5,
                    viewer
                });

                if (mounted) {
                    setChunks([chunk]);
                    nextCursorRef.current = chunk.nextCursor;
                    prevCursorRef.current = chunk.prevCursor ?? null;
                    setHasMore(!!chunk.nextCursor);
                    setHasPrev(!!chunk.prevCursor);
                }
            } catch (err) {
                if (mounted) setError(err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadInitial();

        return () => { mounted = false; };
    }, [bookId, contentProvider, viewer, performance.initialLoadSize]);

    // Ref for restoring scroll position after pruning (works for both directions)
    const scrollAnchorRef = useRef<{ id: string; offset: number } | null>(null);

    // Scroll Restoration Logic
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Set a CSS variable on the container element itself
                el.style.setProperty('--vr-container-height', `${entry.contentRect.height}px`);
            }
        });

        observer.observe(el);
        el.style.setProperty('--vr-container-height', `${el.clientHeight}px`);

        return () => observer.disconnect();
    }, []);

    // Scroll Restoration Logic
    useLayoutEffect(() => {
        const anchor = scrollAnchorRef.current;
        if (!anchor || !containerRef.current) return;

        const container = containerRef.current;

        const element = container.querySelector(`[data-sentence-id="${anchor.id}"]`) as HTMLElement;

        if (element) {
            const newTop = element.getBoundingClientRect().top;

            const diff = newTop - anchor.offset;


            if (diff !== 0) {
                container.scrollTop += diff;
            }
        }

        scrollAnchorRef.current = null;
    }, [chunks]);

    // Helper: Find the first visible sentence anchor (DOM read, outside state setter)
    const findVisibleAnchor = (): { id: string; offset: number } | null => {
        const container = containerRef.current;
        if (!container) return null;

        const elements = container.querySelectorAll('[data-sentence-id]');
        for (let i = 0; i < elements.length; i++) {
            const rect = elements[i].getBoundingClientRect();
            if (rect.bottom > 0) {
                const id = elements[i].getAttribute('data-sentence-id');
                if (id) {
                    return { id, offset: rect.top };
                }
            }
        }
        return null;
    };

    // Load More (Forward — Infinite Scroll Down)
    const loadMore = useCallback(async () => {
        if (loadingRef.current || !hasMore || !nextCursorRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        try {
            const chunk = await contentProvider.getContentChunk({
                bookId,
                cursor: nextCursorRef.current,
                limit: performance.chunkLoadSize || 5,
                direction: 'forward',
                viewer
            });

            // SNAPSHOT: Capture anchor BEFORE state update (DOM read happens here, outside setter)
            const anchor = findVisibleAnchor();
            const activeAnchorId = anchor?.id ?? null;

            if (anchor) {
                scrollAnchorRef.current = anchor;
            }

            // PRUNING LOGIC — prune from head (oldest chunk at front)
            setChunks(prev => {
                const bufferBehind = performance.bufferBehind || 5;
                const bufferAhead = performance.bufferAhead || 10;
                const maxChunks = bufferBehind + 1 + bufferAhead;

                if (prev.length >= maxChunks) {
                    const candidate = prev[0];

                    // SAFETY CHECK: Does the candidate chunk contain our active anchor?
                    const containsAnchor = activeAnchorId !== null &&
                        candidate.items.some(item => item.sentenceId === activeAnchorId);

                    if (containsAnchor) {
                        return [...prev, chunk];
                    }

                    // Proceed with head prune — update prevCursor to next available
                    prevCursorRef.current = prev[1]?.prevCursor ?? null;
                    setHasPrev(!!prevCursorRef.current);

                    const [, ...rest] = prev;
                    return [...rest, chunk];
                }

                return [...prev, chunk];
            });

            nextCursorRef.current = chunk.nextCursor;
            setHasMore(!!chunk.nextCursor);
        } catch (err) {
            setError(err);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, [hasMore, bookId, contentProvider, performance.chunkLoadSize, viewer, performance.bufferBehind, performance.bufferAhead]);

    // Load Previous (Backward — Infinite Scroll Up)
    const loadPrevious = useCallback(async () => {
        if (loadingRef.current || !hasPrev || !prevCursorRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        try {
            const chunk = await contentProvider.getContentChunk({
                bookId,
                cursor: prevCursorRef.current,
                limit: performance.chunkLoadSize || 5,
                direction: 'backward',
                viewer
            });

            // SNAPSHOT: Capture anchor BEFORE state update
            const anchor = findVisibleAnchor();
            const activeAnchorId = anchor?.id ?? null;

            if (anchor) {
                scrollAnchorRef.current = anchor;
            }

            // PRUNING LOGIC — prune from tail (newest chunk at end)
            setChunks(prev => {
                const bufferBehind = performance.bufferBehind || 5;
                const bufferAhead = performance.bufferAhead || 10;
                const maxChunks = bufferBehind + 1 + bufferAhead;

                if (prev.length >= maxChunks) {
                    const candidate = prev[prev.length - 1];

                    // SAFETY CHECK: Does the tail chunk contain the active anchor?
                    const containsAnchor = activeAnchorId !== null &&
                        candidate.items.some(item => item.sentenceId === activeAnchorId);

                    if (containsAnchor) {
                        return [chunk, ...prev];
                    }

                    // Proceed with tail prune — update nextCursor to previous available
                    nextCursorRef.current = prev[prev.length - 2]?.nextCursor ?? null;
                    setHasMore(!!nextCursorRef.current);

                    const rest = prev.slice(0, prev.length - 1);
                    return [chunk, ...rest];
                }

                return [chunk, ...prev];
            });

            prevCursorRef.current = chunk.prevCursor ?? null;
            setHasPrev(!!chunk.prevCursor);
        } catch (err) {
            setError(err);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, [hasPrev, bookId, contentProvider, performance.chunkLoadSize, viewer, performance.bufferBehind, performance.bufferAhead]);

    // Scroll Listener
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = el;

            if (scrollHeight - scrollTop - clientHeight < 200) {
                loadMore();
            }

            if (scrollTop < 200) {
                loadPrevious();
            }
        };

        el.addEventListener('scroll', handleScroll);
        return () => el.removeEventListener('scroll', handleScroll);
    }, [loadMore, loadPrevious]);


    const retryLoad = useCallback(() => {
        setError(null);
        setChunks([]);
        setHasMore(true);
        setHasPrev(false);
        nextCursorRef.current = null;
        prevCursorRef.current = null;

        const doRetry = async () => {
            setLoading(true);
            try {
                const chunk = await contentProvider.getInitialContent({
                    bookId,
                    limit: performance.initialLoadSize || 5,
                    viewer
                });
                setChunks([chunk]);
                nextCursorRef.current = chunk.nextCursor;
                prevCursorRef.current = chunk.prevCursor ?? null;
                setHasMore(!!chunk.nextCursor);
                setHasPrev(!!chunk.prevCursor);
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        doRetry();
    }, [bookId, contentProvider, viewer, performance.initialLoadSize]);

    return {
        chunks,
        loading,
        error,
        containerRef,
        retryLoad
    };
};

