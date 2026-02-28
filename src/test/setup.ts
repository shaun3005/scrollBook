import '@testing-library/jest-dom/vitest';

// jsdom does not implement IntersectionObserver.
// Provide a minimal mock so components using useViewportObserver can mount.
class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: readonly number[] = [];
    observe() { }
    unobserve() { }
    disconnect() { }
    takeRecords(): IntersectionObserverEntry[] { return []; }
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
});

class MockResizeObserver implements ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}

Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: MockResizeObserver,
});
