# verticalRead SDK

A scroll-based eBook reader SDK for embedding vertical reading experiences into host applications.

---

## Overview

**verticalRead** is a React-based UI/UX SDK that enables users to consume long-form content through a vertical, sentence-level scroll interface — similar in interaction model to modern short-form social media feeds. It is purpose-built for eBook and long-form reading services that require seamless, performant content delivery without building the reader layer from scratch.

> **This is not a standalone application.** verticalRead is a UI/UX layer designed exclusively to be embedded into a host service. The host is responsible for all backend concerns: authentication, routing, database access, and API schema design.

---

## Scope of Responsibility

### What this SDK handles
- Vertical, chunk-based infinite scrolling of content
- Viewport-aware, prefetch-driven stats loading (likes, comments)
- Optimistic UI updates for user interactions (like toggles, comment mutations)
- Scroll position preservation during buffer pruning
- Batched, deduplicated network requests for interaction stats
- Comments drawer UI and lifecycle management

### What this SDK does NOT handle
| Concern | Responsibility |
| :--- | :--- |
| Authentication / Authorization | Host service |
| Routing / Navigation | Host service |
| Database / API schema | Host service |
| User account management | Host service |
| Content storage | Host service |

All data exchange between the SDK and the host is strictly mediated through the `ContentProvider` and `InteractionProvider` interfaces. The SDK has zero knowledge of how these are implemented.

---

## Installation

```bash
npm install verticalread react react-dom lucide-react
# or
yarn add verticalread react react-dom lucide-react
```

Import the styles in your entry file:

```ts
import 'verticalread/dist/index.css';
```

---

## Quick Start

The following is the minimum code required to render the reader. Replace the mock providers with your own API-connected implementations.

```tsx
import { VerticalReadReader } from 'verticalread';
import type { ContentProvider, InteractionProvider } from 'verticalread';
import 'verticalread/dist/index.css';

// Minimal mock provider — replace with real API calls
const contentProvider: ContentProvider = {
  async getInitialContent({ bookId, limit }) {
    return {
      bookId,
      items: [{ sentenceId: 's-1', text: 'Your first sentence goes here.' }],
      nextCursor: null,
    };
  },
  async getContentChunk({ cursor, limit, direction }) {
    return { bookId: 'your-book-id', items: [], nextCursor: null };
  },
};

const interactionProvider: InteractionProvider = {
  async getSentenceStats({ sentenceIds }) {
    return Object.fromEntries(
      sentenceIds.map(id => [id, { sentenceId: id, likesCount: 0, commentsCount: 0, likedByMe: false }])
    );
  },
  async toggleLikeSentence({ sentenceId }) {
    return { sentenceId, likedByMe: true, likesCount: 1 };
  },
  async listComments({ sentenceId }) { return []; },
  async addComment({ content }) {
    return { id: 'c-1', sentenceId: 's-1', userId: 'u-1', content, createdAt: new Date().toISOString(), isPublic: true };
  },
  async deleteComment({ commentId }) {
    return { success: true };
  },
};

export default function ReaderPage() {
  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <VerticalReadReader
        bookId="your-book-id"
        contentProvider={contentProvider}
        interactionProvider={interactionProvider}
      />
    </div>
  );
}
```

For full provider implementation patterns and all available props, refer to [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

---

## Performance Defaults

The SDK includes built-in performance defaults that protect host services from excessive network load:

- **Viewport-aware prefetch**: Uses `IntersectionObserver` to detect which sentences are entering the viewport and preemptively fetches their stats before they are visible.
- **Bulk fetching only**: Interaction stats are never fetched per-sentence. All stat requests are batched into a single call (`getSentenceStats`) that the host implements.
- **Debounced batch scheduler**: Requests are held for a configurable debounce window (`debounceMs`) before being dispatched, collapsing rapid scroll events into a single network round-trip.
- **TTL cache**: Fetched stats are cached with a configurable time-to-live (`cacheTtlMs`). IDs with valid cached entries are never re-fetched.
- **Buffer pruning**: To prevent unbounded DOM growth during infinite scroll, old content chunks are pruned from memory once the buffer exceeds the configured threshold.

---

## Configuration

Performance behavior can be tuned by passing a `performance` prop to `VerticalReadReader`. All fields are optional; unset fields use the defaults below.

```tsx
<VerticalReadReader
  bookId="your-book-id"
  contentProvider={contentProvider}
  interactionProvider={interactionProvider}
  performance={{
    batchSize: 30,         // Max sentence IDs per stats request
    debounceMs: 100,       // Debounce window before flushing batch (ms)
    prefetchAhead: 10,     // Sentences ahead of viewport to prefetch stats for
    prefetchBehind: 5,     // Sentences behind viewport to retain in prefetch window
    cacheTtlMs: 60_000,    // Stats cache time-to-live (ms)
    initialLoadSize: 5,    // Number of sentences to load on mount
    chunkLoadSize: 5,      // Number of sentences per subsequent chunk load
    bufferAhead: 10,       // Max chunks to keep ahead in DOM
    bufferBehind: 5,       // Max chunks to keep behind in DOM
  }}
/>
```

---

## Licensing & Legal Disclaimer

**License**: Commercial — Single Purchaser License

By purchasing this SDK, you are granted a **perpetual, non-exclusive license** to:
- Use, modify, and extend the source code within your own products and services.
- Redistribute the SDK as part of your compiled application to your end users.

**Restrictions**:
- You may not resell, sublicense, or transfer the SDK as a standalone product to a third party.
- You may not claim authorship of the original SDK codebase.

**Disclaimer of Liability**:

> This software is provided **"as-is"**, without warranty of any kind, express or implied. The original author assumes **no responsibility** for service disruptions, data loss, security vulnerabilities, or bugs arising from the use of this software after point of sale. No maintenance, updates, or support is guaranteed post-delivery unless explicitly agreed upon in a separate written contract.
