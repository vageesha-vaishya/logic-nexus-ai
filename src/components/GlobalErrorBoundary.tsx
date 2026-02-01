import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import * as Sentry from "@sentry/react";
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    Sentry.captureException(error, { extra: errorInfo as any });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="flex justify-center">
              <div className="h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
              <p className="text-muted-foreground">
                An unexpected error occurred. We've been notified and are working to fix it.
              </p>
            </div>

            {this.state.error && process.env.NODE_ENV === 'development' && (
              <div className="text-left p-4 bg-muted rounded-lg overflow-auto max-h-48 text-xs font-mono">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button onClick={() => window.history.back()} variant="outline">
                Go Back
              </Button>
              <Button onClick={this.handleReload}>
                Reload Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
