export interface UiStrings {
    // Comments Drawer
    commentsTitle: string;
    noComments: string;
    loginToComment: string;
    commentPlaceholder: string;
    commentPublicLabel: string;
    commentSubmit: string;
    commentDelete: string;

    // Interaction Overlay
    shareLabel: string;
    shareCopied: string;
}

export const DEFAULT_UI_STRINGS: UiStrings = {
    commentsTitle: "Comments",
    noComments: "No comments yet. Be the first!",
    loginToComment: "Log in to comment",
    commentPlaceholder: "Add a comment...",
    commentPublicLabel: "Public",
    commentSubmit: "Post",
    commentDelete: "Delete",
    shareLabel: "Share",
    shareCopied: "Copied to clipboard",
};
