import React from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
    public state: State = {
        hasError: false
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public static getDerivedStateFromError(_: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        try {
            this.props.onError?.(error, errorInfo);
        } catch {
            // Ignore errors thrown by the error handler itself
        }
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="vertical-read-error" style={{
                    padding: '20px',
                    textAlign: 'center',
                    background: '#2a0000',
                    color: '#ffaaaa',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <h2>Something went wrong.</h2>
                    <p>The reading experience could not be loaded.</p>
                </div>
            );
        }

        return this.props.children;
    }
}
