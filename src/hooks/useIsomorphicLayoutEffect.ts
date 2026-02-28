import { useEffect, useLayoutEffect } from 'react';

/**
 * A custom hook that resolves to useLayoutEffect on the client and useEffect on the server.
 * This prevents the "useLayoutEffect does nothing on the server" warning in SSR environments like Next.js.
 */
export const useIsomorphicLayoutEffect =
    typeof window !== 'undefined' ? useLayoutEffect : useEffect;
