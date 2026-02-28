import { useEffect, useRef, useState, useCallback } from 'react';
import type { SentenceId } from '../types/model';

export type RegisterRefCallback = (id: SentenceId) => (node: HTMLElement | null) => void;

export const useViewportObserver = () => {
    const [visibleSentenceIds, setVisibleSentenceIds] = useState<SentenceId[]>([]);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const elementsRef = useRef<Map<SentenceId, HTMLElement>>(new Map());

    useEffect(() => {
        // Create observer
        observerRef.current = new IntersectionObserver(
            (entries) => {
                setVisibleSentenceIds((prev) => {
                    const next = new Set(prev);

                    entries.forEach((entry) => {
                        const id = entry.target.getAttribute('data-sentence-id');
                        if (!id) return;

                        if (entry.isIntersecting) {
                            next.add(id);
                        } else {
                            next.delete(id);
                        }
                    });

                    // Only update state if changed to prevent re-renders
                    if (prev.length === next.size && prev.every(id => next.has(id))) {
                        return prev;
                    }

                    return Array.from(next);
                });
            },
            {
                threshold: 0.1, // Trigger when 10% visible
                rootMargin: '100px 0px 100px 0px' // Pre-detect slightly before entering
            }
        );

        return () => {
            observerRef.current?.disconnect();
        };
    }, []);

    const registerRef: RegisterRefCallback = useCallback((id: SentenceId) => (node: HTMLElement | null) => {
        if (node) {

            node.setAttribute('data-sentence-id', id);
            elementsRef.current.set(id, node);
            observerRef.current?.observe(node);
        } else {

            const el = elementsRef.current.get(id);
            if (el) {
                observerRef.current?.unobserve(el);
                elementsRef.current.delete(id);
            }
        }
    }, []);

    return {
        visibleSentenceIds,
        registerRef
    };
};
