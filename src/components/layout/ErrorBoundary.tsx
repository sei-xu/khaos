import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Root-level safety net: before this existed, any throw inside a mounted
// component's render or effect (e.g. useDbChangeFeed's Realtime subscribe)
// unmounted the whole React tree with no feedback — "the app goes blank" —
// instead of failing the one feature that threw. React only catches render/
// lifecycle/effect errors here, not ones inside event handlers or async
// callbacks running outside React's call stack.
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="bg-nyx-900 flex h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-nyx-100 text-body font-medium">
          Something went wrong.
        </p>
        <p className="text-nyx-500 text-caption max-w-sm">
          {this.state.error.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-eros-500 text-nyx-900 hover:bg-eros-400 text-body rounded-lg px-4 py-2 font-medium transition-colors"
        >
          Reload
        </button>
      </div>
    );
  }
}
