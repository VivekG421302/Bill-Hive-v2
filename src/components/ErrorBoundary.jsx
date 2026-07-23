import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[BillHive] Page crash:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '32px 24px', maxWidth: 480, margin: '40px auto',
          background: 'var(--bg-card)', border: '1.5px solid var(--accent-danger)',
          borderRadius: 'var(--radius)', color: 'var(--text-primary)'
        }}>
          <h2 style={{ color: 'var(--accent-danger)', marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 20 }}>
            {this.state.error?.message || 'An unexpected error occurred on this page.'}
          </p>
          <button
            className="action-btn btn-save"
            onClick={() => {
              this.setState({ error: null });
              window.location.href = '/';
            }}
          >
            Go to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
