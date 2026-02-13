import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../utils';

/**
 * React Error Boundary that catches render errors
 * and displays a graceful fallback UI with a retry option.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ hasError: false, error: null })} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950 text-stone-50 p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="w-16 h-16 mx-auto flex items-center justify-center bg-red-900/20 rounded-2xl">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="font-serif text-2xl font-bold">Something went wrong</h2>
        <p className="text-stone-400 text-sm">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={onRetry}
          className="px-8 py-3 bg-stone-50 text-stone-900 font-bold text-xs uppercase tracking-widest hover:bg-stone-200 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

export default ErrorBoundary;
