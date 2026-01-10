import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useRef, useState } from 'react';

type UnauthorizedState = {
  reason?: string;
  missingPermissions?: string[];
  requiredRole?: string;
  from?: string;
} | null;

export default function Unauthorized() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, roles, permissions, isPlatformAdmin } = useAuth();
  const state = (location.state as UnauthorizedState) || null;
  const [showDebug, setShowDebug] = useState(false);

  const platformAdmin = isPlatformAdmin();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    if (!platformAdmin) return;
    if (!state?.from) return;
    if (state.reason !== 'missing_permissions') return;

    redirectedRef.current = true;
    navigate(state.from, { replace: true });
  }, [navigate, platformAdmin, state?.from, state?.reason]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-lg w-full">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access this resource.
          </p>
          
          {state?.missingPermissions && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-lg text-sm border border-destructive/20 text-left">
              <p className="font-semibold text-destructive mb-1">Missing Permissions:</p>
              <div className="flex flex-wrap gap-1">
                {state.missingPermissions.map(p => (
                  <code key={p} className="bg-background px-2 py-1 rounded text-xs border">{p}</code>
                ))}
              </div>
            </div>
          )}
          
          {state?.requiredRole && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-lg text-sm border border-destructive/20 text-left">
              <p className="font-semibold text-destructive mb-1">Missing Role:</p>
              <code className="bg-background px-2 py-1 rounded text-xs border">{state.requiredRole}</code>
            </div>
          )}

          <div className="pt-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowDebug(!showDebug)}
              className="text-muted-foreground text-xs"
            >
              {showDebug ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
            </Button>
            
            {showDebug && (
              <div className="mt-2 p-4 bg-muted rounded-lg text-left text-xs font-mono overflow-auto max-h-[300px] border">
                <div className="space-y-2">
                  <div>
                    <span className="font-bold text-primary">User ID:</span> {user?.id}
                  </div>
                  <div>
                    <span className="font-bold text-primary">Platform Admin:</span> {isPlatformAdmin() ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <span className="font-bold text-primary">Roles:</span>
                    <pre className="mt-1 p-2 bg-background rounded border">
                      {JSON.stringify(roles, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="font-bold text-primary">Current Permissions ({permissions.length}):</span>
                    <div className="mt-1 p-2 bg-background rounded border h-32 overflow-y-auto">
                      {permissions.sort().map(p => (
                        <div key={p}>{p}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go Back
          </Button>
          <Button onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
