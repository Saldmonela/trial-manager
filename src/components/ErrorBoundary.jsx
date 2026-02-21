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
  const { theme } = useTheme();

  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center p-8 transition-colors",
      theme === 'light' ? "bg-stone-50 text-stone-900" : "bg-stone-950 text-stone-50"
    )}>
      <div className="max-w-md text-center space-y-6">
        <div className={cn(
          "w-16 h-16 mx-auto flex items-center justify-center rounded-2xl",
          theme === 'light' ? "bg-red-100 text-red-600" : "bg-red-900/20 text-red-500"
        )}>
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="font-serif text-2xl font-bold">Something went wrong</h2>
        <p className={cn("text-sm", theme === 'light' ? "text-stone-500" : "text-stone-400")}>
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={onRetry}
          className={cn(
            "px-8 py-3 font-bold text-xs uppercase tracking-widest transition-colors",
            theme === 'light'
              ? "bg-stone-900 text-stone-50 hover:bg-stone-700"
              : "bg-stone-50 text-stone-900 hover:bg-stone-200"
          )}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

export default ErrorBoundary;
