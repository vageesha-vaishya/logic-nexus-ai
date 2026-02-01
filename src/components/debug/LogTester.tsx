import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { logger } from '@/lib/logger';
import { useDebug } from '@/hooks/useDebug';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export const LogTester = () => {
  const debug = useDebug('Debug', 'Tester');
  const [errorState, setErrorState] = useState(false);
  const [status, setStatus] = useState<string>('');

  // Trigger runtime error
  if (errorState) {
    throw new Error('Simulated Runtime Error for Testing');
  }

  const handleLogLevels = () => {
    // System Logger
    logger.debug('Test Debug Log', { test_id: '123', meta: 'debug-data' });
    logger.info('Test Info Log', { user_action: 'test_click' });
    logger.warn('Test Warning Log', { risk_level: 'medium', resource: 'memory' });
    logger.error('Test Error Log', { error_code: 'E505', stack: 'mock stack' });
    logger.critical('Test Critical Log', { system_status: 'degraded' });
    logger.fatal('Test Fatal Log', { reason: 'manual_trigger', error: new Error('Fatal System Failure') });
    
    // Debug Store (useDebug)
    debug.debug('Debug Store: Debug Log', { foo: 'bar' });
    debug.info('Debug Store: Info Log', { user: 'tester' });
    debug.warn('Debug Store: Warn Log', { attempts: 3 });
    debug.error('Debug Store: Error Log', { error: 'mock' });

    setStatus('Logged events for all levels (Logger + DebugStore)');
  };

  const handlePromiseRejection = () => {
    setStatus('Triggered unhandled promise rejection');
    Promise.reject(new Error('Simulated Unhandled Rejection'));
  };

  const handleApiError = async () => {
    setStatus('Triggering API 500 Error...');
    try {
      await fetch('https://httpstat.us/500');
      setStatus('API request completed (check logs)');
    } catch (e) {
      setStatus('API request failed (check logs)');
    }
  };

  const handleSlowRequest = async () => {
    setStatus('Triggering Slow Request (delay 2s)...');
    try {
      await fetch('https://httpstat.us/200?sleep=2000');
      setStatus('Slow request completed (check logs)');
    } catch (e) {
        setStatus('Slow request failed');
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Log System Verification</CardTitle>
          <CardDescription>Simulate various error scenarios to verify logging infrastructure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <Button onClick={handleLogLevels} variant="outline">
              Log All Levels (Debug - Fatal)
            </Button>
            
            <div className="grid grid-cols-2 gap-3">
                <Button onClick={handlePromiseRejection} variant="secondary">
                Promise Rejection
                </Button>
                <Button onClick={handleApiError} variant="secondary">
                API 500 Error
                </Button>
            </div>
            
            <Button onClick={handleSlowRequest} variant="secondary">
              Slow API Request
            </Button>

            <Button onClick={() => setErrorState(true)} variant="destructive">
              Trigger React Crash (Runtime)
            </Button>
          </div>

          {status && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Status</AlertTitle>
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
