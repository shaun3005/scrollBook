import React from 'react';
import type { SentenceStats } from '../types/model';
import type { UiStrings } from '../types/strings';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import styles from '../VerticalReadReader.module.css';

export interface InteractionOverlayProps {
    stats?: SentenceStats;
    onToggleLike: () => void;
    onOpenComments: () => void;
    onShare?: () => void;
    strings: UiStrings;
}

const InteractionOverlay: React.FC<InteractionOverlayProps> = ({
    stats,
    onToggleLike,
    onOpenComments,
    onShare,
    strings,
}) => {
    const likesCount = stats?.likesCount || 0;
    const commentsCount = stats?.commentsCount || 0;
    const likedByMe = stats?.likedByMe || false;

    return (
        <div className={styles.interactionOverlay}>
            {/* Like Button */}
            <div className={styles.interactionItem}>
                <button
                    onClick={onToggleLike}
                    aria-label="Like"
                    aria-pressed={likedByMe}
                    className={styles.interactionBtn}
                >
                    <Heart
                        size={32}
                        fill={likedByMe ? '#ff0050' : 'transparent'}
                        color={likedByMe ? '#ff0050' : 'white'}
                        strokeWidth={2}
                    />
                </button>
                <span className={styles.interactionCount}>{likesCount}</span>
            </div>

            {/* Comment Button */}
            <div className={styles.interactionItem}>
                <button
                    onClick={onOpenComments}
                    aria-label="Open comments"
                    className={styles.interactionBtn}
                >
                    <MessageCircle size={32} color="white" strokeWidth={2} />
                </button>
                <span className={styles.interactionCount}>{commentsCount}</span>
            </div>

            {/* Share Button */}
            <div className={styles.interactionItem}>
                <button
                    onClick={onShare}
                    aria-label="Share"
                    className={styles.interactionBtnIconOnly}
                >
                    <Share2 size={32} color="white" strokeWidth={2} />
                </button>
                <span className={styles.interactionCount}>{strings.shareLabel}</span>
            </div>

        </div>
    );
};

export default InteractionOverlay;
