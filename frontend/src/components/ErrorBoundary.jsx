'use client';

import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '1rem',
          color: '#ef4444',
          background: 'rgba(239,68,68,0.1)',
          borderRadius: '8px',
          fontSize: '0.85rem',
        }}>
          <strong>Something went wrong</strong>
          <pre style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.7, whiteSpace: 'pre-wrap' }}>
            {this.state.error?.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
