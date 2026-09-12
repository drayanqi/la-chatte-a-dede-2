/**
 * ErrorBoundary - Catches React rendering errors
 * OWNER: Dev Team
 */

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            padding: '20px',
            backgroundColor: '#1e1e1e',
            color: '#f14c4c',
            minHeight: '100vh',
          }}
          data-testid="error-boundary"
        >
          <h1>Something went wrong</h1>
          <p style={{ color: '#d4d4d4' }}>
            An unexpected error occurred. Try reloading the page.
          </p>
          <button
            style={{
              padding: '8px 16px',
              backgroundColor: '#0e639c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
