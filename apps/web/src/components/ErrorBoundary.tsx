import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  name?: string;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}] Uncaught component error:`,
      error,
      errorInfo,
    );
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(
          this.state.error || new Error('Unknown error'),
          this.handleReset,
        );
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      const componentLabel = this.props.name || 'Component';

      return (
        <div className="w-full my-4 p-6 rounded-2xl bg-[#111827] border border-red-500/30 shadow-2xl flex flex-col items-center text-center space-y-4">
          <div className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white flex items-center justify-center gap-2">
              <span>{componentLabel} Failed to Render</span>
            </h3>
            <p className="text-xs text-[#94A3B8] max-w-md">
              An unexpected runtime error occurred within the local sandbox. The rest of the
              application remains operational.
            </p>
          </div>

          {this.state.error && (
            <div className="w-full max-w-lg p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-left">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider text-red-400 mb-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Error Diagnostic</span>
              </div>
              <p className="text-xs font-mono text-red-200/90 break-words line-clamp-3">
                {this.state.error.message || String(this.state.error)}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-medium shadow-lg shadow-[#7C3AED]/20 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
