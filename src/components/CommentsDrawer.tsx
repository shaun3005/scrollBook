import React, { useState, useEffect, useRef } from 'react';
import type { Comment, SentenceId } from '../types/model';
import type { Viewer } from '../types/provider';
import type { UiStrings } from '../types/strings';
import styles from '../VerticalReadReader.module.css';

export interface CommentsDrawerProps {
    isOpen: boolean;
    activeSentenceId: SentenceId | null;
    onClose: () => void;
    comments: Comment[];
    loading: boolean;
    onAddComment: (content: string, isPublic: boolean) => void;
    onDeleteComment?: (commentId: string) => void;
    viewer?: Viewer;
    onRequireLogin?: () => void;
    strings: UiStrings;
}

const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
    isOpen,
    activeSentenceId,
    onClose,
    comments,
    loading,
    onAddComment,
    onDeleteComment,
    viewer,
    onRequireLogin,
    strings,
}) => {
    const [newComment, setNewComment] = useState('');
    const [isPublic, setIsPublic] = useState(true);

    // Focus trap & ESC key handling
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOpen) {
            closeBtnRef.current?.focus();

            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    onClose();
                }
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        onAddComment(newComment, isPublic);
        setNewComment('');
    };

    return (
        <div className={styles.drawerOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="vr-drawer-title">
            <div className={styles.drawerSheet} onClick={e => e.stopPropagation()}>
                <div className={styles.drawerHeader}>
                    <span className={styles.drawerTitle} id="vr-drawer-title">
                        {strings.commentsTitle} {activeSentenceId ? `(${activeSentenceId})` : ''} ({comments.length})
                    </span>
                    <button className={styles.drawerClose} onClick={onClose} aria-label="Close comments" ref={closeBtnRef}>&times;</button>
                </div>

                <div className={styles.drawerBody}>
                    {loading ? <div className={`${styles.spinner} ${styles.drawerSpinner}`} /> : comments.length === 0 ? (
                        <p className={styles.noComments}>{strings.noComments}</p>
                    ) : (
                        comments.map(c => (
                            <div key={c.id} className={styles.commentItem}>
                                <div className={styles.commentAvatar}></div>
                                <div className={styles.commentBody}>
                                    <div className={styles.commentHeader}>
                                        <span className={styles.commentUsername}>{c.username || 'User'}</span>
                                        <span className={styles.commentDate}>{new Date(c.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className={styles.commentContent}>{c.content}</div>
                                    {viewer && viewer.id === c.userId && (
                                        <div className={styles.commentActions}>
                                            <button className={styles.commentDelete} aria-label="Delete comment" onClick={() => onDeleteComment?.(c.id)}>{strings.commentDelete}</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className={styles.drawerFooter}>
                    {viewer ? (
                        <form onSubmit={handleSubmit} className={styles.drawerForm}>
                            <input
                                type="text"
                                aria-label="Add a comment"
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                placeholder={strings.commentPlaceholder}
                                className={styles.commentInput}
                            />
                            <div className={styles.commentPublicRow}>
                                <input
                                    type="checkbox"
                                    checked={isPublic}
                                    onChange={e => setIsPublic(e.target.checked)}
                                    id="chk-public"
                                    style={{ accentColor: '#ff0050' }}
                                />
                                <label htmlFor="chk-public" className={styles.commentPublicLabel}>{strings.commentPublicLabel}</label>
                            </div>
                            <button
                                type="submit"
                                aria-label="Submit comment"
                                className={styles.commentSubmit}
                                style={{
                                    background: newComment.trim() ? '#ff0050' : '#444',
                                    opacity: newComment.trim() ? 1 : 0.5
                                }}
                                disabled={!newComment.trim()}
                            >
                                {strings.commentSubmit}
                            </button>
                        </form>
                    ) : (
                        <div className={styles.loginPrompt} onClick={() => {
                            onRequireLogin?.();
                        }}>
                            {strings.loginToComment}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommentsDrawer;
