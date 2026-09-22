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
            backgroundColor: 'var(--bg)',
            color: 'var(--corail)',
            minHeight: '100vh',
          }}
          data-testid="error-boundary"
        >
          <h1>Something went wrong</h1>
          <p style={{ color: 'var(--muted)' }}>
            An unexpected error occurred. Try reloading the page.
          </p>
          <button
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--corail)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--r-btn)',
              cursor: 'pointer',
              fontWeight: 700,
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
