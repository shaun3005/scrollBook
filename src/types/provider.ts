import type {
    BookId,
    SentenceId,
    SentenceStats,
    Comment,
    ContentChunk,
    ContentAnchor,
    ContentCursor
} from './model';

export interface Viewer {
    id: string;
    roles?: string[];
    [key: string]: unknown;
}

/**
 * Interface that the host must implement to provide content to the Reader.
 * Must support chunk-based lazy loading.
 */
export interface ContentProvider {
    /**
     * Load the initial chunk of content.
     */
    getInitialContent(args: {
        bookId: BookId;
        anchor?: ContentAnchor;
        limit: number;
        viewer?: Viewer;
    }): Promise<ContentChunk>;

    /**
     * Load more content in a specific direction.
     */
    getContentChunk(args: {
        bookId: BookId;
        cursor: ContentCursor;
        limit: number;
        direction: 'forward' | 'backward';
        viewer?: Viewer;
    }): Promise<ContentChunk>;
}

/**
 * Interface that the host must implement to handle user interactions.
 * Enforces bulk lookups for performance.
 */
export interface InteractionProvider {
    /**
     * Bulk fetch interaction stats for multiple sentences.
     * This is the ONLY way the SDK fetches stats (no per-sentence fetch).
     */
    getSentenceStats(args: {
        bookId: BookId;
        sentenceIds: SentenceId[];
        viewer?: Viewer;
    }): Promise<Record<SentenceId, SentenceStats>>;

    /**
     * Toggle like on a sentence.
     */
    toggleLikeSentence(args: {
        bookId: BookId;
        sentenceId: SentenceId;
        viewer: Viewer; // Login required
    }): Promise<{
        sentenceId: SentenceId;
        likedByMe: boolean;
        likesCount?: number;
    }>;

    /**
     * List comments for a sentence (On-demand only).
     */
    listComments(args: {
        bookId: BookId;
        sentenceId: SentenceId;
        viewer?: Viewer;
    }): Promise<Comment[]>;

    /**
     * Add a new comment.
     */
    addComment(args: {
        bookId: BookId;
        sentenceId: SentenceId;
        content: string;
        isPublic: boolean;
        viewer: Viewer; // Login required
    }): Promise<Comment>;

    deleteComment(args: {
        bookId: BookId;
        commentId: string;
        viewer: Viewer;
    }): Promise<{ success: boolean }>;
}
