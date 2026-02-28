import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewportObserver } from './useViewportObserver';

// Enhanced mock for IntersectionObserver that captures the callback
type ObserverCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;

let observerCallback: ObserverCallback;
let observedElements: Set<Element>;
let unobservedElements: Set<Element>;
let disconnectCalled: boolean;

class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: readonly number[] = [];

    constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback as unknown as ObserverCallback;
    }

    observe(target: Element) {
        observedElements.add(target);
    }

    unobserve(target: Element) {
        unobservedElements.add(target);
    }

    disconnect() {
        disconnectCalled = true;
    }

    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
}

describe('useViewportObserver', () => {
    beforeEach(() => {
        observedElements = new Set();
        unobservedElements = new Set();
        disconnectCalled = false;

        Object.defineProperty(globalThis, 'IntersectionObserver', {
            writable: true,
            configurable: true,
            value: MockIntersectionObserver,
        });
    });

    it('returns initial empty visible IDs', () => {
        const { result } = renderHook(() => useViewportObserver());

        expect(result.current.visibleSentenceIds).toEqual([]);
        expect(typeof result.current.registerRef).toBe('function');
    });

    it('registerRef observes an element when node is provided', () => {
        const { result } = renderHook(() => useViewportObserver());

        const node = document.createElement('div');

        act(() => {
            result.current.registerRef('s1')(node);
        });

        expect(node.getAttribute('data-sentence-id')).toBe('s1');
        expect(observedElements.has(node)).toBe(true);
    });

    it('registerRef unobserves an element when null is provided', () => {
        const { result } = renderHook(() => useViewportObserver());

        const node = document.createElement('div');

        act(() => {
            result.current.registerRef('s1')(node);
        });

        act(() => {
            result.current.registerRef('s1')(null);
        });

        expect(unobservedElements.has(node)).toBe(true);
    });

    it('adds visible IDs when IntersectionObserver reports isIntersecting', () => {
        const { result } = renderHook(() => useViewportObserver());

        const node = document.createElement('div');
        node.setAttribute('data-sentence-id', 's1');

        act(() => {
            result.current.registerRef('s1')(node);
        });

        act(() => {
            observerCallback([
                { target: node, isIntersecting: true } as Partial<IntersectionObserverEntry>,
            ]);
        });

        expect(result.current.visibleSentenceIds).toContain('s1');
    });

    it('removes visible IDs when IntersectionObserver reports not isIntersecting', () => {
        const { result } = renderHook(() => useViewportObserver());

        const node = document.createElement('div');
        node.setAttribute('data-sentence-id', 's1');

        act(() => {
            result.current.registerRef('s1')(node);
        });

        // First, make it visible
        act(() => {
            observerCallback([
                { target: node, isIntersecting: true } as Partial<IntersectionObserverEntry>,
            ]);
        });

        expect(result.current.visibleSentenceIds).toContain('s1');

        // Then remove from view
        act(() => {
            observerCallback([
                { target: node, isIntersecting: false } as Partial<IntersectionObserverEntry>,
            ]);
        });

        expect(result.current.visibleSentenceIds).not.toContain('s1');
    });

    it('handles multiple elements simultaneously', () => {
        const { result } = renderHook(() => useViewportObserver());

        const node1 = document.createElement('div');
        const node2 = document.createElement('div');
        node1.setAttribute('data-sentence-id', 's1');
        node2.setAttribute('data-sentence-id', 's2');

        act(() => {
            result.current.registerRef('s1')(node1);
            result.current.registerRef('s2')(node2);
        });

        act(() => {
            observerCallback([
                { target: node1, isIntersecting: true } as Partial<IntersectionObserverEntry>,
                { target: node2, isIntersecting: true } as Partial<IntersectionObserverEntry>,
            ]);
        });

        expect(result.current.visibleSentenceIds).toContain('s1');
        expect(result.current.visibleSentenceIds).toContain('s2');
        expect(result.current.visibleSentenceIds).toHaveLength(2);
    });

    it('does not update state when visibility set remains unchanged', () => {
        const { result } = renderHook(() => useViewportObserver());

        const node = document.createElement('div');
        node.setAttribute('data-sentence-id', 's1');

        act(() => {
            result.current.registerRef('s1')(node);
        });

        act(() => {
            observerCallback([
                { target: node, isIntersecting: true } as Partial<IntersectionObserverEntry>,
            ]);
        });

        const firstRef = result.current.visibleSentenceIds;

        // Fire same event again
        act(() => {
            observerCallback([
                { target: node, isIntersecting: true } as Partial<IntersectionObserverEntry>,
            ]);
        });

        // Should be referentially identical (no re-render)
        expect(result.current.visibleSentenceIds).toBe(firstRef);
    });

    it('disconnects observer on unmount', () => {
        const { unmount } = renderHook(() => useViewportObserver());

        unmount();

        expect(disconnectCalled).toBe(true);
    });

    it('ignores elements without data-sentence-id attribute', () => {
        const { result } = renderHook(() => useViewportObserver());

        const node = document.createElement('div');
        // Deliberately no data-sentence-id

        act(() => {
            observerCallback([
                { target: node, isIntersecting: true } as Partial<IntersectionObserverEntry>,
            ]);
        });

        expect(result.current.visibleSentenceIds).toEqual([]);
    });
});
