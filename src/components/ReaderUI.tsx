import type { Comment, ContentChunk, SentenceId, SentenceStats } from '../types/model';
import type { Viewer } from '../types/provider';
import type { UiStrings } from '../types/strings';
import BookPage from './BookPage';
import InteractionOverlay from './InteractionOverlay';
import CommentsDrawer from './CommentsDrawer';
import styles from '../VerticalReadReader.module.css';

export type ReaderUIProps = {
    chunks: ContentChunk[];
    loading: boolean;
    interaction: {
        getStats: (id: SentenceId) => SentenceStats | undefined;
        toggleLike: (id: SentenceId) => void;
        // Add other interaction handlers here
    };
    // Comments Controller State
    comments: {
        isOpen: boolean;
        activeSentenceId: SentenceId | null;
        data: Comment[];
        loading: boolean;
        onOpen: (sentenceId: SentenceId) => void;
        onClose: () => void;
        onAdd: (content: string, isPublic: boolean) => void;
        onDelete?: (id: string) => void;
        onRequireLogin?: () => void;
    };
    viewer?: Viewer;
    containerRef?: React.RefObject<HTMLDivElement | null>;
    onRegisterItem?: (id: SentenceId) => (node: HTMLElement | null) => void;
    strings: UiStrings;
    error?: unknown;
    onRetry?: () => void;
    onShare?: (text: string) => void;
};

export default function ReaderUI({
    chunks,
    loading,
    interaction,
    comments,
    viewer,
    containerRef,
    onRegisterItem,
    strings,
    error,
    onRetry,
    onShare,
}: ReaderUIProps) {
    return (
        <div
            className={styles.container}
            style={{ position: 'relative', height: '100%', overflowY: 'auto' }}
            ref={containerRef}
            role="feed"
            aria-busy={loading}
        >
            {/* Content Layer */}
            <div className={styles.content}>
                {chunks.map((chunk, chunkIndex) => (
                    <div key={chunk.items[0]?.sentenceId || chunkIndex} className={styles.chunkGroup} data-chunk-id={chunkIndex}>
                        {chunk.items.map((item) => (
                            <div
                                key={`${chunk.bookId}-${item.sentenceId}`}
                                className={styles.sentenceWrapper}
                                ref={onRegisterItem ? onRegisterItem(item.sentenceId) : undefined}
                                data-sentence-id={item.sentenceId}
                            >
                                <BookPage
                                    data={item}
                                />

                                <InteractionOverlay
                                    stats={interaction.getStats(item.sentenceId)}
                                    onToggleLike={() => interaction.toggleLike(item.sentenceId)}
                                    onOpenComments={() => comments.onOpen(item.sentenceId)}
                                    onShare={() => {
                                        if (onShare) {
                                            onShare(item.text);
                                        } else if (typeof window !== 'undefined') {
                                            navigator.clipboard.writeText(item.text)
                                                .then(() => alert(strings.shareCopied))
                                                .catch((err) => console.error('Failed to copy text: ', err));
                                        }
                                    }}
                                    strings={strings}
                                />
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {loading && <div className={styles.spinner} />}

            {/* Retry fallback on load error */}
            {!!error && !loading && onRetry && (
                <div className={styles.retryContainer}>
                    <p>{strings.errorLoadContent}</p>
                    <button className={styles.retryButton} onClick={onRetry}>
                        {strings.actionRetry}
                    </button>
                </div>
            )}

            {/* Drawer Layer */}
            {comments.isOpen && (
                <CommentsDrawer
                    isOpen={comments.isOpen}
                    activeSentenceId={comments.activeSentenceId}
                    onClose={comments.onClose}
                    comments={comments.data}
                    loading={comments.loading}
                    onAddComment={comments.onAdd}
                    onDeleteComment={comments.onDelete}
                    viewer={viewer}
                    onRequireLogin={comments.onRequireLogin}
                    strings={strings}
                />
            )}
        </div>
    );
}
