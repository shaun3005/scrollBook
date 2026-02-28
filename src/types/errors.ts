export type SdkErrorScope = 'content' | 'stats' | 'comments';

export class SdkError extends Error {
    scope: SdkErrorScope;
    override cause?: unknown;

    constructor(
        message: string,
        scope: SdkErrorScope,
        cause?: unknown
    ) {
        super(message);
        this.name = 'SdkError';
        this.scope = scope;
        this.cause = cause;
    }
}
