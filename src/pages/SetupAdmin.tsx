/**
 * SetupAdmin — first-time platform admin bootstrap.
 *
 * Operator enters the email + a strong password at runtime; nothing is
 * hardcoded. Previous revisions of this file shipped a literal
 * `Vimal@1234` constant, which leaked through every build artifact +
 * GitHub history — that password is now treated as compromised and was
 * rotated in Supabase Auth on 2026-05-26 (manual operator step).
 *
 * Hard-blocked on the Capacitor native shell (Sthira APK) regardless of
 * audience — the mobile app is for retail end-users only, never for
 * platform bootstrap. Web access is also gated: once a platform admin
 * exists, repeated seeding is a no-op at the edge-function level
 * (`seed-platform-admin` returns an existing-user response).
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { H2 } from '@/components/ui/Heading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Shield } from 'lucide-react';
import { invokeAnonymous } from '@/lib/supabase-functions';
import { logger } from "@/lib/logger";

function isStrongPassword(value: string): boolean {
  if (value.length < 12) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  if (!/[^A-Za-z0-9]/.test(value)) return false;
  return true;
}

function isNativeShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export default function SetupAdmin() {
  // Hooks first (rules-of-hooks); native-shell guard is the next statement
  // after, so the early return doesn't break hook ordering.
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [created,  setCreated]  = useState(false);

  // Native shell (Sthira APK) must never reach the platform-bootstrap UI.
  // Send them to the audience-appropriate root and let the existing routing
  // resolve where they belong.
  if (isNativeShell()) {
    return <Navigate to="/" replace />;
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Enter the admin email.');
      return;
    }
    if (!isStrongPassword(password)) {
      toast.error('Password must be 12+ chars with upper, lower, number, and symbol.');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = await invokeAnonymous<{ success?: boolean; error?: string }>('seed-platform-admin', {
        email: email.trim(),
        password,
      });
      if (data?.success) {
        toast.success('Platform admin created. You can now sign in.');
        setCreated(true);
      } else {
        toast.error(data?.error || 'Failed to create admin');
      }
    } catch (error: unknown) {
      logger.error('Setup error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create platform admin');
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
          <H2>Platform Setup</H2>
          <CardDescription>Create the platform administrator account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {created ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/10 text-center space-y-2">
                <p className="font-medium">✅ Admin created successfully</p>
                <p className="text-sm text-muted-foreground">
                  Email: <span className="font-mono">{email}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Sign in with the password you just set. This page is no
                  longer needed; close it.
                </p>
              </div>
              <Button className="w-full" onClick={() => { window.location.href = '/auth'; }}>
                Go to Sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="setup-email">Admin email</Label>
                <Input
                  id="setup-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="admin@yourdomain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="setup-password">Password</Label>
                <Input
                  id="setup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="12+ chars, upper / lower / number / symbol"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="setup-confirm">Confirm password</Label>
                <Input
                  id="setup-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-amber-600">
                ⚠️ Save this password in your password manager — it is shown
                only here, never again. The platform admin can change it
                later from account settings.
              </p>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Platform Admin…
                  </>
                ) : (
                  'Create Platform Admin'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
