import { Component, type ReactNode } from "react";
import { Button } from "./Button";

interface Props {
  children: ReactNode;
  /** Heading shown when a child throws during render. */
  title?: string;
  /** Optional "leave"/dismiss action (e.g. exit the call). */
  onLeave?: () => void;
  leaveLabel?: string;
}

interface State {
  error: Error | null;
}

// Route-level backstop: a throwing child (e.g. a Convex query that rejects
// mid-render during a join/leave race) is contained here with a recoverable
// fallback, instead of unmounting the whole app.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="grid h-full place-items-center bg-discord-bg p-6 text-center">
          <div className="max-w-sm">
            <h2 className="mb-1 text-lg font-semibold text-discord-text">
              {this.props.title ?? "Something went wrong."}
            </h2>
            <p className="mb-4 text-sm text-discord-muted">
              {this.state.error.message}
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={this.reset}>
                Try again
              </Button>
              {this.props.onLeave && (
                <Button
                  variant="danger"
                  onClick={() => {
                    this.reset();
                    this.props.onLeave!();
                  }}
                >
                  {this.props.leaveLabel ?? "Leave"}
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
