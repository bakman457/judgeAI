import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** Short opaque token the user can quote when contacting support. */
  requestId: string;
}

const isDevMode = import.meta.env.DEV;

/** Generate a short, human-readable incident token (no crypto dependency). */
function generateRequestId(): string {
  return `${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, requestId: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, requestId: generateRequestId() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Always log to the console so developers can see the full stack,
    // even when we don't render it on screen.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>

            {isDevMode ? (
              <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
                <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                  {this.state.error?.stack}
                </pre>
              </div>
            ) : (
              <p className="mb-6 text-sm text-muted-foreground text-center">
                The application hit an unexpected problem. Reload to try again. If
                the issue persists, contact support and quote request ID:{" "}
                <code className="font-mono select-all">{this.state.requestId}</code>
              </p>
            )}

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
