import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabase-functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import sosLogo from '@/assets/sos-logo.png';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      loginSchema.parse({ email, password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      // If initial admin credentials fail, attempt to auto-seed the admin account
      const isAdminEmail = email.trim().toLowerCase() === 'bahuguna.vimal@gmail.com';
      if (error.message.includes('Invalid login credentials') && isAdminEmail) {
        try {
          const { data, error: seedError } = await invokeFunction('seed-platform-admin', {
            body: { email, password }
          });

          if (seedError) {
            // Fall back to guidance if seeding fails
            toast.error('Admin account not found. Use Setup to create it.');
          } else if (data?.success) {
            toast.success('Admin created. Signing you in...');
            const { error: retryError } = await signIn(email, password);
            if (!retryError) {
              navigate(from, { replace: true });
              setLoading(false);
              return;
            }
          }
        } catch (e: any) {
          // Edge function may not be deployed; guide the user
          toast.error('Setup required. Please run Platform Setup.');
        }
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Please verify your email address');
      } else if (error.message.includes('Failed to fetch')) {
        toast.error('Connection Error', { 
          description: 'Could not connect to the server. Please check your internet connection or VPN.' 
        });
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    toast.success('Welcome back!');
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src={sosLogo} alt="SOS Logistic Pro Enterprise" className="h-20 w-20" />
          </div>
          <CardTitle className="text-2xl font-bold">SOS Logistic Pro Enterprise</CardTitle>
          <CardDescription>
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                data-testid="email-input"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="password-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="login-btn">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
            <div className="pt-2 text-center text-sm text-muted-foreground">
              First time setup? <a href="/setup-admin" className="text-primary underline">Create Platform Admin</a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
