import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Injected in tests; defaults to console in the app. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
}

/**
 * Crash boundary (REQ-8). The user-visible message is deliberately
 * generic: a thrown error's message can carry tender content, pricing,
 * or an API payload fragment, none of which belongs on screen or in a
 * screenshot. Diagnostics go to the injected reporter instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center"
      >
        <h1 className="text-lg font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The workspace hit an unexpected problem. Your local data has not been
          changed.
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    );
  }
}
