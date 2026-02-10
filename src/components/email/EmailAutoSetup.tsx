import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invokeFunction, invokeAnonymous } from "@/lib/supabase-functions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { initiateGoogleOAuth, initiateMicrosoftOAuth } from "@/lib/oauth";
import { useCRM } from "@/hooks/useCRM";
import { supabase } from "@/integrations/supabase/client";

interface EmailAutoSetupProps {
  onSuccess: () => void;
  onManual: () => void;
  onClose: () => void;
}

export function EmailAutoSetup({ onSuccess, onManual, onClose }: EmailAutoSetupProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<'email' | 'password' | 'verifying' | 'success'>('email');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { context } = useCRM();

  const handleDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use invokeAnonymous to bypass potentially broken User Session for public discovery
      const data = await invokeAnonymous("discover-email-settings", { email });

      console.log("Discovery Result:", data);

      if (data.provider === 'unknown') {
        toast({
          title: "Could not auto-detect settings",
          description: "Please configure your account manually.",
        });
        onManual();
        return;
      }

      setSettings(data);

      if (data.type === 'oauth') {
        handleOAuth(data.provider);
      } else {
        // IMAP/Basic Auth
        setStep('password');
      }
    } catch (err: any) {
      console.error("Discovery failed:", err);
      let message = err.message || "Failed to discover settings";
      if (message === "Failed to fetch") {
        message = "Network error. Please check your internet connection or try again.";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: string) => {
    try {
      sessionStorage.setItem("oauth_hint_email", email);
      sessionStorage.setItem("oauth_hint_name", email.split('@')[0]); // Basic display name
      sessionStorage.setItem("oauth_hint_is_primary", "false"); // Default to false
      
      if (provider === 'gmail') {
        await initiateGoogleOAuth(context.userId);
      } else if (provider === 'office365') {
        await initiateMicrosoftOAuth(context.userId);
      } else {
        throw new Error(`OAuth provider ${provider} not supported yet`);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Password is required");
      return;
    }

    setStep('verifying');
    setError(null);

    try {
      // 1. Verify Credentials
      const imapConfig = {
        ...settings.imap,
        username: settings.imap.username.replace('%EMAIL%', email), // Ensure replacement
        password: password
      };

      // Use invokeAnonymous for verification as well, as it only depends on the passed credentials
      const verifyData = await invokeAnonymous("verify-email-credentials", { 
          imap: imapConfig,
          smtp: settings.smtp // Pass SMTP too if we want to verify it later, but IMAP is enough for read
      });

      if (!verifyData.success) {
        throw new Error(verifyData?.error || "Authentication failed. Please check your password.");
      }

      // 2. Save Account
      const payload = {
        user_id: context.userId,
        tenant_id: context.tenantId,
        franchise_id: context.franchiseId,
        provider: 'smtp_imap', // Store as generic IMAP/SMTP
        email_address: email,
        display_name: email.split('@')[0],
        is_primary: false,
        is_active: true,
        // IMAP
        imap_host: imapConfig.host,
        imap_port: imapConfig.port,
        imap_username: imapConfig.username,
        imap_password: password,
        imap_use_ssl: imapConfig.secure,
        // SMTP (Best guess or from discovery)
        smtp_host: settings.smtp?.host,
        smtp_port: settings.smtp?.port,
        smtp_username: settings.smtp?.username?.replace('%EMAIL%', email) || imapConfig.username,
        smtp_password: password,
        smtp_use_tls: settings.smtp?.socketType !== 'PLAIN'
      };

      const { error: saveError } = await supabase
        .from("email_accounts")
        .insert(payload as any);

      if (saveError) throw saveError;

      setStep('success');
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect account");
      setStep('password'); // Go back to password step
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="bg-primary/10 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Add Email Account</h2>
        <p className="text-muted-foreground">
          Enter your email to automatically configure your account
        </p>
      </div>

      {step === 'email' && (
        <form onSubmit={handleDiscovery} className="space-y-4 max-w-md mx-auto">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="you@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Finding Settings...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
          
          <div className="text-center pt-4">
             <Button variant="link" type="button" onClick={onManual} className="text-muted-foreground">
               Configure Manually
             </Button>
          </div>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={handleConnect} className="space-y-4 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4">
          <div className="space-y-2">
            <Label>Account Detected</Label>
            <div className="p-3 bg-muted rounded-md flex items-center gap-3">
               <Mail className="w-5 h-5 text-muted-foreground" />
               <span className="font-medium">{email}</span>
            </div>
            <p className="text-xs text-muted-foreground">
               Provider: {settings?.displayName || settings?.provider || 'IMAP'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              placeholder="Enter your email password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
             <p className="text-xs text-muted-foreground">
               Your credentials are encrypted and stored securely.
             </p>
          </div>

          {error && (
            <div className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
             <Button type="button" variant="outline" onClick={() => setStep('email')} className="flex-1">
               Back
             </Button>
             <Button type="submit" className="flex-1" disabled={loading}>
               Connect Account
             </Button>
          </div>
        </form>
      )}

      {step === 'verifying' && (
         <div className="text-center space-y-4 py-8">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
            <div>
              <h3 className="text-lg font-medium">Verifying Credentials...</h3>
              <p className="text-muted-foreground">We are testing the connection to your mail server.</p>
            </div>
         </div>
      )}

      {step === 'success' && (
         <div className="text-center space-y-4 py-8 animate-in zoom-in duration-300">
            <div className="bg-green-100 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center text-green-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-green-700">Account Connected!</h3>
              <p className="text-muted-foreground">Your emails will start syncing shortly.</p>
            </div>
         </div>
      )}
    </div>
  );
}
