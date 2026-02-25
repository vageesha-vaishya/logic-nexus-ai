import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Shield, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { invokeFunction } from '@/lib/supabase-functions';

export default function SetupAdmin() {
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const ADMIN_EMAIL = 'Bahuguna.vimal@gmail.com';
  const ADMIN_PASS = 'Vimal@1234';

  const copyPassword = () => {
    navigator.clipboard.writeText(ADMIN_PASS);
    setCopied(true);
    toast.success('Password copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSetup = async () => {
    setLoading(true);

    try {
      const { data, error } = await invokeFunction('seed-platform-admin', {
        body: {
          email: ADMIN_EMAIL,
          password: ADMIN_PASS
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

  const PasswordDisplay = () => (
    <div className="flex items-center gap-2 mt-1">
      <span className="font-mono bg-muted px-2 py-0.5 rounded text-foreground">
        {showPassword ? ADMIN_PASS : '••••••••'}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setShowPassword(!showPassword)}
        title={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={copyPassword}
        title="Copy password"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );

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
              <div className="p-4 rounded-lg bg-primary/10 text-center space-y-2">
                <p className="font-medium mb-2">✅ Admin Created Successfully</p>
                <div className="text-sm text-muted-foreground flex flex-col items-center gap-1">
                  <span>Email: {ADMIN_EMAIL}</span>
                  <div className="flex items-center gap-2">
                    <span>Password:</span>
                    <PasswordDisplay />
                  </div>
                </div>
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
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Email: {ADMIN_EMAIL}</p>
                  <div className="flex items-center gap-2">
                    <span>• Password:</span>
                    <PasswordDisplay />
                  </div>
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
