# verticalRead SDK — Project Overview

> This document serves as the foundational context for the verticalRead SDK project. It covers the service purpose, product vision, system architecture, module structure, core workflows, and integration interface design.

---

## 1. What Is verticalRead?

### The Service Concept

**verticalRead** is a reading experience SDK that reimagines how people consume books on digital screens.

Traditionally, digital books are presented as pages — horizontal swipes or page-turns that mimic the physical book. verticalRead takes a fundamentally different approach: it presents book content **sentence by sentence, in a continuous vertical scroll**, much like reading a social media feed. Users scroll downward through the text, with each sentence or passage occupying its own visual card in the viewport.

This UX pattern is not arbitrary. It is designed around how people actually read on mobile devices today — in short bursts, in portrait orientation, with visual engagement cues (likes, comments) that sustain attention and signal meaning. verticalRead brings this interaction model to long-form book content.

### Why This Matters

Long-form reading on mobile has historically suffered from high drop-off rates. Users find page-based eBook UIs cognitively demanding — they require intentional navigation, offer little social signal, and provide no sense of momentum. verticalRead addresses this by:

- **Reducing friction**: Scrolling is the most natural gesture on a mobile device. No tap targets, no page navigation — the user simply scrolls.
- **Surfacing social context**: Likes and comments attached to individual sentences allow readers to see what others found meaningful, creating ambient social presence without interrupting the reading flow.
- **Creating momentum**: The continuous scroll eliminates "page boundaries" as cognitive stopping points, encouraging deeper session lengths.

### What Is the SDK?

verticalRead is **not a standalone application**. It is a **UI/UX engine** — specifically, an embeddable React SDK — designed to be integrated into existing eBook platforms and reading services.

The typical buyer is an operator of an existing eBook service (such as a digital library platform, a subscription reading service, or a publishing platform) that wants to add a vertical reading UX without rebuilding their product from the ground up. They install the SDK, implement two data provider interfaces, and the reader is operational within their existing product.

> **The SDK's purpose is to give any eBook service a vertical reading experience, delivered as a single droppable component.**

---

## 2. Target Customers & Use Cases

### Primary Buyers

- Operators of existing large eBook platforms (e.g., Kyobo, Millie, RIDI, or equivalent services in other markets)
- Organizations that already own their own DRM, payment, user authentication, book databases, search, and library systems
- Product teams that want to run PoC or A/B tests for a **new reading UX** without committing to a full platform rebuild

### What They Purchase

Buyers are purchasing three things:

1. **A Vertical Reading UX Engine**: sentence-level vertical scroll, viewport-aware rendering, smooth infinite scroll with memory management.
2. **Interaction UI patterns**: like/comment/stats overlay on individual sentences, comments drawer, optimistic UI with rollback.
3. **A performance-safe integration layer**: the SDK ships with built-in guardrails that prevent the common failure modes of high-volume reading apps — request explosion, DOM bloat, scroll stutter.

### What Buyers Are NOT Buying

The SDK deliberately excludes everything that existing platforms already own:

- No authentication or user session management
- No routing or navigation
- No database schema or storage model
- No admin or ops features
- No content management

---

## 3. Core Design Principles

Three non-negotiable principles govern all architectural decisions in this SDK:

### Principle 1: Autonomy (Host-Agnostic Design)
The SDK core must never directly call a database, a specific backend SDK (Supabase, Firebase, etc.), or any host-specific REST endpoint. All data exchange is mediated exclusively through the `ContentProvider` and `InteractionProvider` interfaces. The SDK does not know — and must not be able to infer — the host's storage model, authentication system, or service architecture.

### Principle 2: Performance-First
In B2B embedded SDK contexts, a slow component is indistinguishable from a broken product. The SDK ships with built-in performance defaults: bulk-only stats fetching, viewport-based lazy loading, debounced batch scheduling, TTL caching, and DOM buffer pruning. These are configurable defaults included in the SDK.

### Principle 3: Declarative Configuration
All performance parameters — prefetch windows, cache TTLs, batch sizes, buffer depths — are exposed as a single `PerformanceConfig` prop. Buyers can tune the SDK's behavior to match their network conditions and traffic patterns without modifying SDK source code.

---

## 4. System Architecture & Layered Structure

The SDK is organized into three distinct layers, each with a precisely bounded responsibility.

```
┌──────────────────────────────────────────────────────────┐
│                     [ UI Layer ]                         │
│   ReaderUI.tsx, BookPage.tsx, InteractionOverlay.tsx     │
│   CommentsDrawer.tsx                                     │
│                                                          │
│   Role: Pure rendering only. No side effects.            │
│         Receives data via props, emits events via         │
│         callbacks. Has no knowledge of data sources.     │
└────────────────────────┬─────────────────────────────────┘
                         │ props (data flows down)
                         │ callbacks (events flow up)
┌────────────────────────▼─────────────────────────────────┐
│                 [ Controller Layer ]                     │
│   VerticalReadReader.tsx  (orchestrator / entry point)   │
│   useReaderController     (content loading + scroll)     │
│   useInteractionController (stats, likes, cache)         │
│   useCommentsController   (comments drawer lifecycle)    │
│   useViewportObserver     (IntersectionObserver mgmt)    │
│   useStatsPrefetcher      (prefetch coordination)        │
│                                                          │
│   Role: All business logic, state, side effects,         │
│         and performance guardrails live here.            │
└────────────────────────┬─────────────────────────────────┘
                         │ Provider interface calls only
                         │ (async functions — no direct API)
┌────────────────────────▼─────────────────────────────────┐
│                  [ Provider Layer ]                      │
│   ContentProvider interface (defined by SDK)             │
│   InteractionProvider interface (defined by SDK)         │
│   Implementations: owned and written by the buyer        │
│                                                          │
│   Role: The contract boundary between the SDK and the    │
│         host's backend. The SDK defines the shape;       │
│         the buyer writes the implementation.             │
└──────────────────────────────────────────────────────────┘
```

The most important property of this architecture is **strict layer isolation**. The UI layer cannot reach the Provider layer directly. The Provider layer has no knowledge of how its data will be rendered. Every cross-layer communication flows through the Controller layer.

---

## 5. Module Connectivity & Dependency Map

```
src/types/
  ├── model.ts      ← All domain types (BookId, SentenceId, ContentChunk, Comment, etc.)
  │                   No dependencies. All other modules depend on this.
  ├── config.ts     ← PerformanceConfig type and DEFAULT_PERFORMANCE_CONFIG.
  └── provider.ts   ← ContentProvider and InteractionProvider interface contracts.

src/lib/
  └── BatchScheduler.ts  ← Standalone utility for batched, debounced async scheduling.
                           Used exclusively by useInteractionController.

src/hooks/
  ├── useReaderController.ts
  │     Calls ContentProvider → produces `chunks[]` state.
  │     Owns infinite scroll trigger, buffer pruning, and scroll restoration.
  │
  ├── useInteractionController.ts
  │     Calls InteractionProvider via BatchScheduler → produces `statsMap` state.
  │     Owns TTL cache, optimistic updates, and like toggle with rollback.
  │
  ├── useCommentsController.ts
  │     Calls InteractionProvider (on-demand only) → produces `comments[]` state.
  │     Owns drawer open/close lifecycle and comment add/delete with rollback.
  │
  ├── useViewportObserver.ts
  │     Uses IntersectionObserver API → produces `visibleSentenceIds[]`.
  │     Provides `registerRef` callback for UI components to register DOM nodes.
  │
  └── useStatsPrefetcher.ts
        Consumes visibleSentenceIds + chunks → calls prefetchStats().
        Computes ahead/behind prefetch window and triggers batch loading.

src/VerticalReadReader.tsx
  └── Orchestrates all hooks. Passes derived state and callbacks to ReaderUI.
      This is the single public entry point of the SDK.

src/components/
  ├── ReaderUI.tsx           ← Lays out all sub-components. Stateless.
  ├── BookPage.tsx           ← Renders a single sentence/content card.
  ├── InteractionOverlay.tsx ← Renders like/comment counts per sentence.
  └── CommentsDrawer.tsx     ← Renders the comments panel UI.
```

**Unidirectional Data Flow**: Data always travels `Provider → Controller → VerticalReadReader → ReaderUI → sub-components`. Sub-components never mutate shared state directly; they emit events upward via callback props.

---

## 6. Core Workflow Patterns

### [Workflow A] — Initial Load
1. Host renders `<VerticalReadReader bookId="..." contentProvider={...} interactionProvider={...} />`
2. All controller hooks initialize. `BatchScheduler` and `IntersectionObserver` instances are created.
3. `useReaderController` fires `contentProvider.getInitialContent()` on mount.
4. The returned `ContentChunk` is stored in `chunks[]` state, triggering a render.
5. `ReaderUI` renders each sentence item as a `BookPage`, registering each DOM node with `useViewportObserver`.

### [Workflow B] — Stats Prefetch Pipeline
1. As `BookPage` components enter the viewport, `useViewportObserver`'s `IntersectionObserver` fires (threshold: 10%, with a 100px pre-detection margin).
2. `visibleSentenceIds` state is updated with newly visible sentence IDs.
3. `useStatsPrefetcher` reacts: it computes a prefetch window (`prefetchAhead` + `prefetchBehind`) around the visible range.
4. It calls `prefetchStats(ids[])` on `useInteractionController`.
5. `useInteractionController` checks each ID against the TTL cache. IDs without valid cache are passed to `BatchScheduler.schedule()`.
6. `BatchScheduler` holds requests for `debounceMs` (default: 100ms), then flushes in batches of up to `batchSize` (default: 30) as a single call to `interactionProvider.getSentenceStats()`.
7. Results are stored in `statsMap` with a `fetchedAt` timestamp. `InteractionOverlay` components re-render with live stats.

### [Workflow C] — Like Toggle (Optimistic Update)
1. User taps the like button on a sentence. `InteractionOverlay` calls `interaction.toggleLike(sentenceId)`.
2. `useInteractionController.toggleLike()` immediately updates `statsMap` with an optimistic state (no network wait). UI reflects the change instantly.
3. `interactionProvider.toggleLikeSentence()` is called asynchronously.
4. On success: `statsMap` is reconciled with the server's authoritative response.
5. On failure: `statsMap` is rolled back to the pre-toggle state. The UI reverts silently.

### [Workflow D] — Infinite Scroll & Buffer Pruning
1. `useReaderController` attaches a `scroll` event listener to the scroll container.
2. When the user scrolls within 200px of the bottom, `loadMore()` is triggered.
3. `loadMore()` captures a DOM snapshot of the currently visible sentence (anchor position) **before** any state mutation.
4. `contentProvider.getContentChunk(cursor, 'forward')` is called. The new chunk is appended to `chunks[]`.
5. If `chunks.length` exceeds `bufferBehind + 1 + bufferAhead`, the oldest chunk is pruned from the front of the array — **unless** it contains the current anchor sentence (safety guard).
6. After state update, `useLayoutEffect` reads the new position of the anchor element, computes the drift, and corrects `scrollTop` before the browser paints. The user perceives no jump.

---

## 7. Integration Interface: The Provider Pattern

The Provider pattern is the most critical architectural decision in this SDK. It is the mechanism by which the SDK achieves host-agnosticism.

### The Contract Metaphor

A TypeScript `interface` is a **contract**: it specifies what functions must exist, what inputs they accept, and what outputs they must return. The SDK defines the contracts (`ContentProvider`, `InteractionProvider`). The buyer writes the implementations that fulfill those contracts by calling their own backend APIs.

The SDK calls the interface. It does not know — and cannot know — what lies behind it.

```typescript
// The contract (SDK defines this, ships in dist/types/provider.d.ts)
interface ContentProvider {
  getInitialContent(args: { bookId, limit, viewer? }): Promise<ContentChunk>;
  getContentChunk(args: { bookId, cursor, limit, direction, viewer? }): Promise<ContentChunk>;
}

// The implementation (buyer writes this, in their own codebase)
const contentProvider: ContentProvider = {
  async getInitialContent({ bookId, limit }) {
    const res = await fetch(`https://api.myservice.com/books/${bookId}/sentences?limit=${limit}`, {
      headers: { Authorization: `Bearer ${myAuthToken}` }
    });
    const data = await res.json();
    return {
      bookId,
      items: data.sentences.map(s => ({ sentenceId: s.id, text: s.text })),
      nextCursor: data.nextCursor
    };
  },
  // ...
};
```

### Responsibility Division

| Concern | SDK | Buyer (Host) |
| :--- | :---: | :---: |
| Vertical scroll reading UX | ✅ | — |
| Interaction overlay (likes, comments) | ✅ | — |
| Performance guardrails (batching, cache) | ✅ | — |
| Provider interface contracts | ✅ | — |
| Provider implementations (API calls) | — | ✅ |
| Authentication / user sessions | — | ✅ |
| Routing and navigation | — | ✅ |
| Database / storage schema | — | ✅ |
| Content management and DRM | — | ✅ |

### Why This Design Is Correct

An alternative design would have the SDK call backend APIs directly (REST/GraphQL). This approach fails in B2B contexts because:
- The buyer's authentication scheme (SSO, session tokens, API keys) is unknown to the SDK at design time.
- The buyer's data models and API schemas are proprietary and variable.
- Hard-coding any backend dependency into the SDK core makes it non-portable and creates a security concern for buyers whose security teams must audit third-party components.

The Provider pattern eliminates all of these objections. The SDK is auditable in isolation, and the buyer's backend never needs to expose its internals to the SDK vendor.
