# verticalRead SDK — Integration Guide

> **Audience**: Senior software engineers responsible for integrating the SDK into a host application.
> **Prerequisite**: Familiarity with React, TypeScript, and async data fetching patterns.

---

## Table of Contents

1. [Technical Architecture Blueprint](#1-technical-architecture-blueprint)
2. [Installation & Component API](#2-installation--component-api)
3. [Deep Dive: The Provider Contract](#3-deep-dive-the-provider-contract)
4. [Performance Tuning & Configuration](#4-performance-tuning--configuration)
5. [Integration Checklist](#5-integration-checklist)

---

## 1. Technical Architecture Blueprint

### 1.1 Internal Module Breakdown

The SDK is structured around three clearly bounded layers. Understanding these boundaries is essential before writing any integration code.

```
src/
├── types/
│   ├── model.ts          — Domain types: all shared data shapes (ContentChunk, Comment, SentenceStats, etc.)
│   ├── provider.ts       — Interface contracts: ContentProvider, InteractionProvider
│   └── config.ts         — PerformanceConfig type + DEFAULT_PERFORMANCE_CONFIG
│
├── lib/
│   └── BatchScheduler.ts — Standalone batch/debounce scheduler for stats fetching
│
├── hooks/
│   ├── useReaderController.ts       — Content loading, infinite scroll, buffer pruning, scroll restoration
│   ├── useInteractionController.ts  — Stats cache, optimistic likes, batch scheduling
│   ├── useCommentsController.ts     — Comments drawer lifecycle, add/delete with rollback
│   ├── useViewportObserver.ts       — IntersectionObserver management, visible sentence tracking
│   └── useStatsPrefetcher.ts        — Prefetch window computation and prefetch invocation
│
├── components/
│   ├── ReaderUI.tsx            — Top-level layout: coordinates content, overlays, and drawer
│   ├── BookPage.tsx            — Renders a single sentence/content card
│   ├── InteractionOverlay.tsx  — Per-sentence like/comment count UI
│   └── CommentsDrawer.tsx      — Slide-in comments panel
│
├── VerticalReadReader.tsx    — Single public entry point. Orchestrates all hooks; passes derived state to UI.
├── VerticalReadReader.css    — Scoped styles for all SDK components (`.vertical-read-*` namespace)
└── index.ts                  — Public exports: component, types, interfaces
```

### 1.2 File Roles & Interactions

**`VerticalReadReader.tsx`** is the orchestrator. It initializes all controller hooks, merges the host-provided `PerformanceConfig` with defaults, and passes the resulting state and callbacks down to `ReaderUI`. It is the only boundary between the SDK's internal logic and the host application. The host never imports or references any file other than `index.ts`.

**Controller Hooks** own all side effects. Each hook has a single, clearly scoped responsibility:
- `useReaderController` is the sole caller of `ContentProvider` methods.
- `useInteractionController` is the sole caller of `InteractionProvider.getSentenceStats` and `toggleLikeSentence`. It owns the stats cache and the `BatchScheduler` instance.
- `useCommentsController` is the sole caller of `InteractionProvider.listComments`, `addComment`, and `deleteComment`.

**`BatchScheduler`** is a stateful class that accepts individual `schedule(id, callback)` calls and aggregates them internally. After a configurable debounce window, it flushes the accumulated IDs as a single batched network request. It is instantiated once per `useInteractionController` mount.

**UI Components** are purely presentational. They receive state and callbacks via props and render them. They contain no network logic, no direct Provider calls, and no knowledge of data sources.

### 1.3 Data & Control Flow

The unidirectional data flow follows this path:

```
Host App
  └─ renders <VerticalReadReader ...props />
        │
        ├─ useReaderController        ──calls──> ContentProvider
        │   └─ chunks[]              <──data──  (host implementation)
        │
        ├─ useInteractionController   ──calls──> InteractionProvider
        │   └─ statsMap{}            <──data──  via BatchScheduler
        │
        ├─ useCommentsController      ──calls──> InteractionProvider
        │   └─ comments[]            <──data──  (on demand only)
        │
        ├─ useViewportObserver        ──reads──> DOM (IntersectionObserver)
        │   └─ visibleSentenceIds[]
        │
        └─ useStatsPrefetcher
            └─ calls prefetchStats() based on visibleSentenceIds + chunks
                  │
                  └─> triggers BatchScheduler ──> InteractionProvider.getSentenceStats()

All derived state flows down:
VerticalReadReader ──props──> ReaderUI ──props──> BookPage / InteractionOverlay / CommentsDrawer
```

Control signals (user interactions) travel in the opposite direction via callback props, from leaf components up to the controller hooks, which then call the appropriate Provider method.

---

## 2. Installation & Component API

### 2.1 Installation

```bash
npm install project-verticalread react react-dom lucide-react
```

Import styles once in your application entry point:

```ts
import 'project-verticalread/dist/index.css';
```

> **Note**: The SDK styles are scoped under the `.vertical-read-container` class namespace. They are designed to minimize style conflicts, but thorough style isolation testing in your host application is recommended.

### 2.2 Props Specification

`VerticalReadReader` accepts the following props:

```tsx
type VerticalReadReaderProps = {
  bookId: BookId;
  contentProvider: ContentProvider;
  interactionProvider: InteractionProvider;
  viewer?: Viewer;
  performance?: Partial<PerformanceConfig>;
  callbacks?: {
    onRequireLogin?: (reason: 'like' | 'comment' | 'bookmark' | string) => void;
    onError?: (err: unknown, context: { scope: 'content' | 'stats' | 'comments' }) => void;
  };
};
```

| Prop | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `bookId` | `string` | ✅ | The identifier for the book to be read. Passed to all Provider calls as the primary lookup key. Changes to `bookId` will trigger a full re-initialization of the reader state. |
| `contentProvider` | `ContentProvider` | ✅ | The host-implemented object that provides book content to the SDK. Must satisfy the `ContentProvider` interface. See Section 3 for full specification. |
| `interactionProvider` | `InteractionProvider` | ✅ | The host-implemented object that handles all interaction data (stats, likes, comments). Must satisfy the `InteractionProvider` interface. See Section 3 for full specification. |
| `viewer` | `Viewer` | — | The currently authenticated user. If omitted, the SDK treats the session as unauthenticated. Protected actions (like, comment) will trigger `onRequireLogin` instead of executing. |
| `performance` | `Partial<PerformanceConfig>` | — | An optional partial override of the default performance configuration. Unset fields fall back to SDK defaults. See Section 4 for full specification. |
| `callbacks.onRequireLogin` | `function` | — | Called when an unauthenticated user attempts a protected action. The `reason` argument identifies the action type so the host can navigate to the appropriate login flow. |
| `callbacks.onError` | `function` | — | Called when a non-fatal error occurs within a scoped subsystem (`content`, `stats`, or `comments`). The host can use this for logging or displaying a graceful fallback. |

**Viewer type:**
```ts
type Viewer = {
  id: string;
  roles?: string[];
  [key: string]: unknown; // Host may attach additional fields (e.g., tier, permissions)
};
```

### 2.3 Initialization Logic

When `VerticalReadReader` first mounts, the following sequence occurs synchronously and asynchronously:

1. **Config merge**: The host-provided `performance` partial is merged with `DEFAULT_PERFORMANCE_CONFIG`. The merged config is passed to all controller hooks.
2. **BatchScheduler instantiation**: `useInteractionController` creates a `BatchScheduler` instance configured with `batchSize` and `debounceMs`. This instance persists for the lifetime of the component.
3. **IntersectionObserver creation**: `useViewportObserver` registers a new `IntersectionObserver` with a 10% threshold and a 100px root margin for pre-detection.
4. **Initial content fetch**: `useReaderController` fires `contentProvider.getInitialContent()` with `bookId`, `viewer`, and `initialLoadSize`. This is the first network call the SDK makes. Its result populates `chunks[]` state and schedules the first render.
5. **DOM registration**: After the first render, `ReaderUI` registers each rendered sentence element with the `IntersectionObserver` via `onRegisterItem`.
6. **First stats prefetch**: Once visible sentence IDs are detected, `useStatsPrefetcher` computes the initial prefetch window and triggers the first batch stats request.

---

## 3. Deep Dive: The Provider Contract

### 3.1 Conceptual Foundation

The Provider pattern is the SDK's fundamental integration boundary. The SDK defines **interface contracts** — TypeScript `interface` types that specify exactly which methods must exist, what arguments they accept, and what they must return. The host writes **implementations** of these contracts that connect to the host's actual backend infrastructure.

This separation has a critical architectural consequence: the SDK has zero knowledge of how data is stored, fetched, or authenticated on the host side. Conversely, the host's backend is never exposed to the SDK vendor. The interface is the entire surface of contact.

**The SDK calls the interface. It does not know what implements it.**

### 3.2 `ContentProvider`

**Conceptual role**: Provides the book's textual content to the SDK on demand. Content is never loaded in bulk; the SDK fetches data in sequential, cursor-delimited chunks as the user scrolls forward.

```ts
interface ContentProvider {
  getInitialContent(args: {
    bookId: BookId;
    anchor?: ContentAnchor;
    limit: number;
    viewer?: Viewer;
  }): Promise<ContentChunk>;

  getContentChunk(args: {
    bookId: BookId;
    cursor: ContentCursor;
    limit: number;
    direction: 'forward' | 'backward';
    viewer?: Viewer;
  }): Promise<ContentChunk>;

  prefetchContentChunk?(args: {
    bookId: BookId;
    cursor: ContentCursor;
    limit: number;
    direction: 'forward' | 'backward';
    viewer?: Viewer;
  }): Promise<void>;
}
```

**`getInitialContent`**
- **When it is called**: Once, immediately on SDK mount.
- **Host responsibility**: Implement the fetch logic that retrieves the first `limit` sentences of the specified book from the host's content database. If `anchor` is provided (e.g., a sentence ID representing the user's last reading position), the host should use it as the starting point for the returned content.
- **What it must return**: A `ContentChunk` with `items[]` (the sentences), `nextCursor` (an opaque string the SDK will pass back to fetch the next chunk), and optionally `prevCursor`.

**`getContentChunk`**
- **When it is called**: Each time the user scrolls within 200px of the bottom of the rendered content.
- **Host responsibility**: Use the `cursor` value (returned in the previous chunk) to fetch the next page of content. The `direction` field indicates scroll direction (`'forward'` in most cases). The host's implementation maps this cursor to its internal pagination system (page number, offset, keyset, etc.) without exposing that mechanism to the SDK.
- **What it must return**: The next `ContentChunk` with a new `nextCursor`, or `nextCursor: null` to signal that the book has ended.

**`ContentChunk` shape:**
```ts
interface ContentChunk {
  bookId: BookId;
  items: Array<{
    sentenceId: SentenceId;   // Stable, unique identifier for this sentence
    text: string;             // The sentence text
    bookTitle?: string;
    chapterTitle?: string;
    author?: string;
    backgroundImage?: string;
    [key: string]: unknown;   // Host may attach custom metadata
  }>;
  nextCursor: string | null;
  prevCursor?: string | null;
}
```

> **Important**: `sentenceId` must be a **stable, globally unique identifier**. It is used as the key for the stats cache, for scroll anchor restoration, and for the IntersectionObserver. Reusing or recycling sentence IDs will cause incorrect behavior.

### 3.3 `InteractionProvider`

**Conceptual role**: Handles all social interaction data — stats (like/comment counts), like mutations, and comment operations. The design enforces **bulk-only stats fetching** as a structural constraint; there is no single-sentence stats fetch path in the SDK.

```ts
interface InteractionProvider {
  getSentenceStats(args: {
    bookId: BookId;
    sentenceIds: SentenceId[];
    viewer?: Viewer;
  }): Promise<Record<SentenceId, SentenceStats>>;

  toggleLikeSentence(args: {
    bookId: BookId;
    sentenceId: SentenceId;
    viewer: Viewer;
  }): Promise<{ sentenceId: SentenceId; likedByMe: boolean; likesCount?: number }>;

  listComments(args: {
    bookId: BookId;
    sentenceId: SentenceId;
    viewer?: Viewer;
  }): Promise<Comment[]>;

  addComment(args: {
    bookId: BookId;
    sentenceId: SentenceId;
    content: string;
    isPublic: boolean;
    viewer: Viewer;
  }): Promise<Comment>;

  deleteComment?(args: {
    bookId: BookId;
    commentId: string;
    viewer: Viewer;
  }): Promise<{ success: boolean }>;
}
```

**`getSentenceStats`**
- **When it is called**: Via the `BatchScheduler`. Never called directly. The SDK accumulates sentence IDs from the viewport, debounces them for `debounceMs`, and flushes up to `batchSize` IDs per call.
- **Host responsibility**: Implement a **bulk endpoint** on the host's backend that accepts an array of sentence IDs and returns a map of stats. Individual per-sentence lookups in this method will cause the same N+1 performance problem the SDK is designed to prevent.
- **Recommended backend endpoint pattern**: `POST /v1/stats/bulk` with body `{ bookId, sentenceIds[], viewerId? }`.
- **What it must return**: A `Record<SentenceId, SentenceStats>` map. Missing keys are treated as zero-stats by the SDK.

**`toggleLikeSentence`**
- **When it is called**: When a user taps the like button on a sentence while authenticated.
- **Optimistic update behavior**: The SDK immediately mutates its internal stats cache optimistically (before this method resolves). If the method rejects, the SDK rolls back the cache to the pre-toggle state automatically. The host does not need to manage rollback.
- **What it must return**: The updated `likedByMe` boolean and optionally the authoritative `likesCount` from the server. If `likesCount` is omitted, the SDK retains its optimistically computed count until the next batch stats fetch reconciles it.

**`listComments`**
- **When it is called**: Only when the user opens the comments drawer for a specific sentence. Comment data is **never prefetched**.
- **Host responsibility**: Return all comments the current viewer is authorized to see for the given sentence. The SDK assumes the host backend applies `isPublic` filtering and authorization rules before returning. The SDK renders what it receives without applying its own filters.

**`addComment` / `deleteComment`**
- These are called directly in response to explicit user actions (submit, delete).
- The SDK applies **optimistic comment count updates** to the stats cache (via `onCommentCountChange`) immediately. On failure, the count is rolled back.
- `deleteComment` is **optional**. If not implemented, the SDK will log a warning and no-op silently. Omit it only if deletion is not a supported feature in your service.

---

## 4. Performance Tuning & Configuration

The `PerformanceConfig` object exposes every performance-relevant parameter in the SDK. All fields are optional; defaults are shown below.

```ts
type PerformanceConfig = {
  // Stats subsystem
  batchSize: number;           // default: 30
  debounceMs: number;          // default: 100
  prefetchAhead: number;       // default: 10
  prefetchBehind: number;      // default: 5
  cacheTtlMs: number;          // default: 60_000

  // Content subsystem
  initialLoadSize: number;     // default: 5
  chunkLoadSize: number;       // default: 5
  bufferAhead: number;         // default: 10
  bufferBehind: number;        // default: 5
  contentPrefetchEnabled: boolean; // default: false
};
```

### 4.1 Stats Subsystem Parameters

**`batchSize`** (default: `30`)
The maximum number of sentence IDs the SDK will include in a single `getSentenceStats` call. When the scheduler accumulates more IDs than this limit before the debounce window expires, it flushes immediately and begins a new batch.
- **Increase** if your backend bulk endpoint can handle larger payloads efficiently and you have high sentence density per viewport.
- **Decrease** if your backend has strict request body size limits or you observe timeout issues at high batch sizes.
- **Impact**: Higher values reduce total request count; lower values reduce per-request payload size.

**`debounceMs`** (default: `100`)
The time in milliseconds the `BatchScheduler` waits after the last `schedule()` call before flushing the accumulated IDs. During rapid scrolling, new IDs are continuously added; the debounce collapses these into a single network round-trip.
- **Increase** (e.g., `200–300ms`) if your backend cannot sustain frequent requests, at the cost of slightly delayed stat rendering during rapid scroll.
- **Decrease** (e.g., `50ms`) if your infrastructure can handle the load and you want stats to appear immediately as sentences enter the viewport.
- **Impact**: Directly controls the trade-off between perceived UI responsiveness and backend request frequency.

**`prefetchAhead`** (default: `10`)
The number of sentences **ahead** of the current viewport bottom for which the SDK will proactively fetch stats. Sentences not yet visible but within this window will have their stats loaded and cached before the user reaches them, creating the appearance of instant stat rendering on scroll.
- **Increase** on fast-scrolling interfaces or low-latency backends.
- **Decrease** on slow backends or when you want to minimize speculative requests.

**`prefetchBehind`** (default: `5`)
The number of sentences **behind** the current viewport top for which the SDK retains stats in the prefetch calculation. Prevents unnecessary re-fetching when the user briefly scrolls back up.

**`cacheTtlMs`** (default: `60_000` — 60 seconds)
The time-to-live for a cached `SentenceStats` entry. After this duration, the SDK will re-fetch stats for the sentence on its next appearance in the prefetch window.
- **Increase** if your like/comment counts change infrequently and you want to minimize re-fetch overhead.
- **Decrease** if your service has high engagement rates and stale counts would be misleading to users.
- **Note**: Optimistic updates include a fresh `fetchedAt` timestamp, preventing the optimistically updated entry from being evicted during the TTL window.

### 4.2 Content Subsystem Parameters

**`initialLoadSize`** (default: `5`)
The number of sentences requested in `getInitialContent` on mount. Keep this small enough to achieve a fast Time-to-First-Paint. The user does not need to see 50 sentences on mount — they need the first 5 to feel the reader is responsive.

**`chunkLoadSize`** (default: `5`)
The number of sentences requested per `getContentChunk` call during infinite scroll. Balance this against your backend's pagination cost.

**`bufferAhead` / `bufferBehind`** (defaults: `10` / `5`)
Controls the maximum number of content chunks retained in the DOM at any time. When the total chunks exceed `bufferBehind + 1 + bufferAhead`, the oldest chunk is pruned from memory. This prevents unbounded DOM growth and memory leaks during long reading sessions. Scroll position is automatically restored after pruning using a pre-captured DOM anchor snapshot.

**`contentPrefetchEnabled`** (default: `false`)
When `true`, the SDK will call `contentProvider.prefetchContentChunk()` proactively before the user reaches the scroll trigger threshold. Enable only if your host's `ContentProvider` implementation supports prefetch hints (e.g., calling a CDN warm-up endpoint). Disabled by default to avoid unintended backend load.

---

## 5. Integration Checklist

Follow this checklist sequentially to move from installation to a fully operational integration.

### Phase 1 — Environment Setup
- [ ] Install the package: `npm install project-verticalread react react-dom lucide-react`
- [ ] Import styles in your app entry: `import 'project-verticalread/dist/index.css'`
- [ ] Verify TypeScript can resolve `project-verticalread` types (check `tsconfig.json` `moduleResolution`)

### Phase 2 — ContentProvider Implementation
- [ ] Create a class or object that satisfies the `ContentProvider` interface
- [ ] Implement `getInitialContent`: fetch the first N sentences from your content API by `bookId`
- [ ] Implement `getContentChunk`: map the `cursor` argument to your pagination system and return the next chunk
- [ ] Ensure each `item` in `items[]` has a **stable, unique `sentenceId`**
- [ ] Ensure `nextCursor` is `null` when the book has no more content

### Phase 3 — InteractionProvider Implementation
- [ ] Create a class or object that satisfies the `InteractionProvider` interface
- [ ] Implement `getSentenceStats`: wire this to a **bulk endpoint** on your backend (not per-sentence lookups)
- [ ] Implement `toggleLikeSentence`: call your like mutation API; return `likedByMe` and optionally `likesCount`
- [ ] Implement `listComments`: return comments for the given `sentenceId` (apply your own authorization/visibility logic)
- [ ] Implement `addComment`: persist the new comment and return the created `Comment` object
- [ ] (Optional) Implement `deleteComment` if your service supports deletion

### Phase 4 — Component Integration
- [ ] Wrap `VerticalReadReader` in a container with an **explicit height** (e.g., `height: '100vh'`). The SDK's scroll container fills 100% of its parent — a parent with no height will cause the infinite scroll to never trigger.
- [ ] Pass `bookId`, `contentProvider`, and `interactionProvider` as required props
- [ ] Pass `viewer` if the user is authenticated; omit or pass `undefined` for unauthenticated sessions
- [ ] Wire `callbacks.onRequireLogin` to your application's login navigation logic
- [ ] Wire `callbacks.onError` to your error reporting system (Sentry, Datadog, etc.)

### Phase 5 — Performance Validation
- [ ] Open the browser Network tab and confirm that stats are fetched in **batches** (single requests with arrays of IDs, not one request per sentence)
- [ ] Confirm that re-scrolling over previously seen sentences does **not** trigger new network requests for their stats (cache is working)
- [ ] Simulate a long reading session and confirm DOM node count does not grow unboundedly (buffer pruning is active)
- [ ] Tune `batchSize`, `debounceMs`, and `prefetchAhead` based on your backend's observed throughput and latency

### Phase 6 — Pre-Release Checklist
- [ ] Ensure your `ContentProvider` and `InteractionProvider` implementations handle network failures gracefully and re-throw or return appropriate errors so `callbacks.onError` can surface them
- [ ] Confirm `deleteComment` is implemented or explicitly omitted (SDK will warn, not crash, if absent)
- [ ] Validate that `sentenceId` values are stable across re-deploys and data migrations
- [ ] Review the SDK's scoped CSS namespace (`.vertical-read-*`) for any conflicts with your host application's styles
