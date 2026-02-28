export type BookId = string;
export type SentenceId = string;
export type UserId = string;

export interface SentenceStats {
    sentenceId: SentenceId;
    likesCount: number;
    commentsCount: number;
    likedByMe: boolean;
}

export interface Comment {
    id: string;
    sentenceId: SentenceId;
    userId: UserId;
    username?: string;
    content: string;
    createdAt: string; // ISO 8601 string
    isPublic: boolean;
    // Extensible for host specific fields
    [key: string]: unknown;
}

export type ContentAnchor = {
    /** e.g., specific sentence id, specific page index, specific offset, etc. defined by the host */
    [k: string]: unknown;
};

export type ContentCursor = string;

export interface ContentChunk {
    bookId: BookId;
    items: Array<{
        sentenceId: SentenceId;
        text: string;
        bookTitle?: string;
        chapterTitle?: string;
        author?: string;
        backgroundImage?: string;
        [k: string]: unknown;
    }>;
    nextCursor: ContentCursor | null;
    prevCursor?: ContentCursor | null;
}
