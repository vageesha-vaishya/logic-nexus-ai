import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { handleOAuthCallback } from "@/lib/oauth";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get the authorization code from URL
        const { code, provider } = await handleOAuthCallback();

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("User not authenticated");
        }

        // Pull optional hints from session storage
        const emailAddress = sessionStorage.getItem("oauth_hint_email") || undefined;
        const displayName = sessionStorage.getItem("oauth_hint_name") || undefined;
        const isPrimary = sessionStorage.getItem("oauth_hint_is_primary") === "true" || undefined;
        const accountIdHint = sessionStorage.getItem("oauth_account_id") || undefined;

        // Exchange code for tokens
        const { data, error } = await supabase.functions.invoke("exchange-oauth-token", {
          body: {
            code,
            provider,
            userId: user.id,
            emailAddress,
            displayName,
            isPrimary,
            accountIdHint,
          },
        });

        if (error) throw error;

        setStatus("success");
        toast({
          title: "Account Connected",
          description: `Your ${provider === "gmail" ? "Gmail" : "Office 365"} account has been successfully connected.`,
        });

        // Clean hints to avoid leaking between attempts
        sessionStorage.removeItem("oauth_hint_email");
        sessionStorage.removeItem("oauth_hint_name");
        sessionStorage.removeItem("oauth_hint_is_primary");
        sessionStorage.removeItem("oauth_account_id");

        // Redirect to email management page after a short delay
        setTimeout(() => {
          navigate("/dashboard/email-management");
        }, 1200);
      } catch (error: any) {
        console.error("OAuth callback error:", error);
        setStatus("error");
        toast({
          title: "Connection Failed",
          description: error.message || "Failed to connect your email account. Please try again.",
          variant: "destructive",
        });

        // Redirect back after error
        setTimeout(() => {
          navigate("/dashboard/email-management");
        }, 3000);
      }
    };

    processCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === "processing" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
            <h2 className="text-2xl font-semibold">Connecting Your Account</h2>
            <p className="text-muted-foreground">Please wait while we complete the authorization...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-green-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold">Successfully Connected!</h2>
            <p className="text-muted-foreground">Redirecting you back...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold">Connection Failed</h2>
            <p className="text-muted-foreground">Redirecting you back...</p>
          </>
        )}
      </div>
    </div>
  );
}
