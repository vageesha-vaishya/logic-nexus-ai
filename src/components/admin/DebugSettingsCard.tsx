import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Bug } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function DebugSettingsCard() {
  const { user, isPlatformAdmin } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [localDebugEnabled, setLocalDebugEnabled] = useState(false);

  // Sync local state with user metadata, but only when not loading to prevent flickering
  useEffect(() => {
    if (!isLoading && user) {
      setLocalDebugEnabled(!!user.user_metadata?.debug_mode_enabled);
    }
  }, [user?.user_metadata?.debug_mode_enabled, isLoading, user]);

  // Only Platform Admins can see this
  if (!isPlatformAdmin()) {
    return null;
  }

  const toggleDebugMode = async (enabled: boolean) => {
    // Optimistic update
    setLocalDebugEnabled(enabled);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { debug_mode_enabled: enabled }
      });

      if (error) throw error;

      // Force session refresh and verify consistency
      // Retry loop to handle eventual consistency of Supabase Auth tokens
      let retries = 3;
      let synced = false;

      while (retries > 0 && !synced) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;

        // Check if the update has propagated to the current session
        const { data: { user: freshUser } } = await supabase.auth.getUser();
        const freshEnabled = !!freshUser?.user_metadata?.debug_mode_enabled;

        if (freshEnabled === enabled) {
          synced = true;
        } else {
          // Wait briefly before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
          retries--;
        }
      }

      toast({
        title: enabled ? "Debug Mode Enabled" : "Debug Mode Disabled",
        description: enabled 
          ? "You will now see debug inspectors in supported modules." 
          : "Debug inspectors have been hidden.",
      });
      
    } catch (error: any) {
      // Revert optimistic update on error
      setLocalDebugEnabled(!enabled);
      
      toast({
        title: "Error",
        description: error.message || "Failed to update debug settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-900/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          <CardTitle>System Debug Mode</CardTitle>
        </div>
        <CardDescription>
          Enable advanced debugging tools and data inspectors. 
          <span className="font-semibold text-orange-600 dark:text-orange-400 block mt-1">
            Restricted to Platform Administrators only.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between space-x-4">
          <div className="flex flex-col space-y-1">
            <span className="text-sm font-medium leading-none">Enable Data Inspectors</span>
            <span className="text-sm text-muted-foreground">
              Shows floating debug panels with raw data inputs/outputs.
            </span>
          </div>
          <Switch
            checked={localDebugEnabled}
            onCheckedChange={toggleDebugMode}
            disabled={isLoading}
          />
        </div>
      </CardContent>
    </Card>
  );
}
