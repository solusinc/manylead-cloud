"use client";

import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@manylead/ui/button";
import { cn } from "@manylead/ui";
import { env } from "~/env";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for chat components
 * Prevents entire app crash when chat component fails
 *
 * Follows Google's error handling patterns:
 * - Catches errors in component tree
 * - Displays fallback UI
 * - Logs errors for debugging
 * - Provides recovery option
 *
 * @example
 * ```tsx
 * <ChatErrorBoundary>
 *   <ChatWindow chatId={chatId} />
 * </ChatErrorBoundary>
 * ```
 */
export class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console (em produção, enviar para Sentry/etc)
    console.error("ChatErrorBoundary caught an error:", error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // TODO: Send to error tracking service (Sentry, etc.)
    // if (process.env.NODE_ENV === 'production') {
    //   Sentry.captureException(error, {
    //     contexts: { react: { componentStack: errorInfo.componentStack } }
    //   });
    // }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex h-full w-full items-center justify-center bg-background p-8">
          <div className="flex max-w-md flex-col items-center gap-6 text-center">
            {/* Error icon */}
            <div className="bg-destructive/10 text-destructive flex h-16 w-16 items-center justify-center rounded-full">
              <AlertTriangle className="h-8 w-8" />
            </div>

            {/* Error message */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Algo deu errado no chat</h3>
              <p className="text-muted-foreground text-sm">
                Ocorreu um erro ao carregar o chat. Você pode tentar novamente ou recarregar a
                página.
              </p>

              {/* Show error details in development */}
              {env.NODE_ENV === "development" && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="text-destructive cursor-pointer text-xs font-mono">
                    Detalhes do erro (dev only)
                  </summary>
                  <pre className="bg-muted mt-2 overflow-auto rounded p-2 text-xs">
                    {this.state.error.toString()}
                    {"\n\n"}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={this.handleReset}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
              <Button variant="default" onClick={this.handleReload}>
                Recarregar página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Compact Error Boundary for smaller components
 * Shows inline error message instead of full-screen fallback
 */
export class ChatErrorBoundaryCompact extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ChatErrorBoundaryCompact caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className={cn(
            "bg-destructive/10 text-destructive flex items-center gap-3 rounded-lg p-4 text-sm"
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Erro ao carregar componente</p>
            {env.NODE_ENV === "development" && this.state.error && (
              <p className="text-destructive/80 mt-1 text-xs font-mono">
                {this.state.error.message}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={this.handleReset}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
