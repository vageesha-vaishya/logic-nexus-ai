import React, { Component, ErrorInfo } from 'react';
import { LogTester } from '@/components/debug/LogTester';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useDebug } from '@/hooks/useDebug';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("LogTestPage Error Boundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              <p>The application crashed. This is expected if you triggered a test crash.</p>
              <pre className="mt-2 p-2 bg-slate-900 text-white rounded text-xs overflow-auto">
                {this.state.error?.toString()}
              </pre>
              <button 
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

const LogTestPage = () => {
  const debug = useDebug('System', 'LogTestPage');
  
  React.useEffect(() => {
    debug.info('LogTestPage mounting...');
  }, []);

  return (
    <ErrorBoundary>
      <DashboardLayout>
        <div className="container mx-auto py-8">
          <h1 className="text-3xl font-bold mb-6">System Logging Test</h1>
          <LogTester />
        </div>
      </DashboardLayout>
    </ErrorBoundary>
  );
};

export default LogTestPage;
