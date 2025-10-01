import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function SetupAdmin() {
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const handleSetup = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('seed-platform-admin', {
        body: {
          email: 'Bahuguna.vimal@gmail.com',
          password: 'Vimal@1234'
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Platform admin created successfully!');
        setCreated(true);
      } else {
        toast.error(data?.error || 'Failed to create admin');
      }
    } catch (error: any) {
      console.error('Setup error:', error);
      toast.error(error.message || 'Failed to create platform admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Platform Setup</CardTitle>
          <CardDescription>
            Create the platform administrator account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {created ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/10 text-center">
                <p className="font-medium mb-2">✅ Admin Created Successfully</p>
                <p className="text-sm text-muted-foreground">
                  Email: Bahuguna.vimal@gmail.com
                </p>
                <p className="text-sm text-muted-foreground">
                  Password: Vimal@1234
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  ⚠️ Please change password on first login
                </p>
              </div>
              <Button 
                className="w-full" 
                onClick={() => window.location.href = '/auth'}
              >
                Go to Login
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <p className="text-sm font-medium">Platform Admin Details:</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• Email: Bahuguna.vimal@gmail.com</p>
                  <p>• Password: Vimal@1234</p>
                  <p className="text-xs pt-2 text-amber-600">
                    ⚠️ You will be required to change this password on first login
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleSetup} 
                className="w-full" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Platform Admin...
                  </>
                ) : (
                  'Create Platform Admin'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
