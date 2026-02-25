import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import * as Sentry from "@sentry/react";
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  featureName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(`Error in feature: ${this.props.featureName || 'Unknown'}`, {
      error,
      errorInfo,
      module: 'FeatureErrorBoundary'
    });
    Sentry.captureException(error, { 
      extra: { 
        ...errorInfo as any,
        featureName: this.props.featureName 
      } 
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 min-h-[400px] border-2 border-dashed border-destructive/20 rounded-lg bg-destructive/5 text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          
          <div className="space-y-2 max-w-sm">
            <h3 className="text-lg font-semibold tracking-tight">
              {this.props.featureName ? `${this.props.featureName} failed to load` : 'Feature failed to load'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Something went wrong while loading this section of the platform.
            </p>
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={this.handleReset} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button 
              onClick={() => window.location.reload()} 
              variant="ghost" 
              size="sm"
            >
              Reload Page
            </Button>
          </div>

          {this.state.error && process.env.NODE_ENV === 'development' && (
            <div className="mt-6 text-left p-3 bg-muted rounded-md overflow-auto max-h-32 w-full max-w-lg text-[10px] font-mono border">
              {this.state.error.toString()}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
