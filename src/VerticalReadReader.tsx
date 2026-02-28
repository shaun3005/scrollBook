import type { ContentProvider, InteractionProvider, Viewer } from './types/provider';
import { type PerformanceConfig, DEFAULT_PERFORMANCE_CONFIG } from './types/config';
import type { BookId } from './types/model';
import { useReaderController } from './hooks/useReaderController';
import { useInteractionController } from './hooks/useInteractionController';
import { useCommentsController } from './hooks/useCommentsController';
import ReaderUI from './components/ReaderUI';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useViewportObserver } from './hooks/useViewportObserver';
import { useStatsPrefetcher } from './hooks/useStatsPrefetcher';
import type { UiStrings } from './types/strings';
import { DEFAULT_UI_STRINGS } from './types/strings';
import './VerticalReadReader.module.css';


export type VerticalReadReaderProps = {
    bookId: BookId;
    viewer?: Viewer;
    contentProvider: ContentProvider;
    interactionProvider: InteractionProvider;
    performance?: Partial<PerformanceConfig>;
    callbacks?: {
        onRequireLogin?: (reason: 'like' | 'comment' | 'bookmark' | string) => void;
        onError?: (err: unknown, context: { scope: 'content' | 'stats' | 'comments' }) => void;
        onShare?: (text: string) => void;
    };
    strings?: Partial<UiStrings>;
};

export const VerticalReadReader = ({
    bookId,
    viewer,
    contentProvider,
    interactionProvider,
    performance = {},
    callbacks,
    strings = {},
}: VerticalReadReaderProps) => {
    const mergedPerformance = { ...DEFAULT_PERFORMANCE_CONFIG, ...performance };
    const mergedStrings = { ...DEFAULT_UI_STRINGS, ...strings };

    const { chunks, loading, error, containerRef, retryLoad } = useReaderController({
        bookId,
        contentProvider,
        viewer,
        performance: mergedPerformance,
    });

    const interaction = useInteractionController({
        bookId,
        interactionProvider,
        viewer,
        performance: mergedPerformance,
        onRequireLogin: callbacks?.onRequireLogin,
        onError: callbacks?.onError,
    });

    const commentsHelper = useCommentsController({
        bookId,
        interactionProvider,
        viewer,
        onRequireLogin: callbacks?.onRequireLogin,
        onCommentCountChange: interaction.updateCommentCount,
        onError: callbacks?.onError,
    });

    const { visibleSentenceIds, registerRef } = useViewportObserver();

    useStatsPrefetcher({
        visibleSentenceIds,
        chunks,
        performance: mergedPerformance,
        prefetchStats: interaction.prefetchStats,
    });

    if (error) {
        callbacks?.onError?.(error, { scope: 'content' });
    }

    return (
        <ErrorBoundary
            onError={(err) => {
                if (callbacks?.onError) {
                    callbacks.onError(err, { scope: 'content' });
                }
            }}
        >
            <ReaderUI
                chunks={chunks}
                loading={loading}
                interaction={interaction}
                comments={{
                    isOpen: commentsHelper.isOpen,
                    activeSentenceId: commentsHelper.activeSentenceId,
                    data: commentsHelper.comments,
                    loading: commentsHelper.loading,
                    onOpen: commentsHelper.openDrawer,
                    onClose: commentsHelper.closeDrawer,
                    onAdd: commentsHelper.addComment,
                    onDelete: commentsHelper.deleteComment,
                    onRequireLogin: () => callbacks?.onRequireLogin?.('comment')
                }}
                viewer={viewer}
                containerRef={containerRef}
                onRegisterItem={registerRef}
                strings={mergedStrings}
                error={error}
                onRetry={retryLoad}
                onShare={callbacks?.onShare}
            />
        </ErrorBoundary>
    );
};
