import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let parsedError = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; path?: string };
        if (parsed.error) {
          parsedError = `${parsed.error}${parsed.path ? ` (${parsed.path})` : ''}`;
        }
      } catch {
        // Plain error message
      }

      return (
        <div className="min-h-screen bg-[#050507] text-[#F4F4F6] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#0B0C10] border border-white/10 rounded-xl p-8 space-y-4">
            <h1 className="text-xl font-semibold text-white">Something went wrong</h1>
            <p className="text-sm text-zinc-400 leading-relaxed break-words">{parsedError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
