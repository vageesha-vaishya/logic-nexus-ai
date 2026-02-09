
import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Mail, ShieldCheck, Play, RefreshCw, AlertCircle, LogOut, Lock, CheckCircle2 } from "lucide-react";
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';

interface EmailContext {
  subject: string;
  sender: string;
  senderName?: string;
  body: string;
  url: string;
  isEmailView: boolean;
}

interface ThreatResult {
  threat_level: "safe" | "suspicious" | "malicious";
  threat_score: number;
  threat_type: string;
  reasoning: string;
}

interface Sequence {
  id: string;
  name: string;
  description: string;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<EmailContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  
  // Auth State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Compliance State
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [threatResult, setThreatResult] = useState<ThreatResult | null>(null);

  // Sequence State
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState<string | null>(null); // sequenceId
  const [enrollSuccess, setEnrollSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fetchContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setThreatResult(null);
    setEnrollSuccess(false);

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab?.id) {
          setError("No active tab found.");
          setLoading(false);
          return;
        }

        if (!tab.url?.includes("mail.google.com")) {
          setContext(null);
          setLoading(false);
          return;
        }

        chrome.tabs.sendMessage(tab.id, { action: "GET_EMAIL_CONTEXT" }, (response) => {
          if (chrome.runtime.lastError) {
            setError("Please refresh the Gmail tab to activate the extension.");
            setContext(null);
          } else if (response) {
            setContext(response);
          } else {
            setError("No response from Gmail page.");
          }
          setLoading(false);
        });
      } catch (err) {
        console.error(err);
        setError("Failed to communicate with browser.");
        setLoading(false);
      }
    } else {
      // Dev / Mock Mode
      console.log("Running in Dev Mode (Mock Data)");
      setTimeout(() => {
        setContext({
          subject: "Urgent: Wire Transfer Request - Invoice #9982",
          sender: "ceo@partner-logistics.com",
          senderName: "John Doe",
          body: "Please process this payment immediately via wire transfer to our new account.",
          url: "https://mail.google.com/mail/u/0/#inbox/FMfcgzGvx...",
          isEmailView: true
        });
        setLoading(false);
      }, 500);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchContext();
    }
  }, [fetchContext, session]);

  const checkCompliance = async () => {
    if (!context) return;
    setComplianceLoading(true);
    setThreatResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-email-threat', {
        body: { 
          content: {
            subject: context.subject,
            body: context.body,
            sender: context.sender
          }
        }
      });

      if (error) throw error;
      setThreatResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze email.");
    } finally {
      setComplianceLoading(false);
    }
  };

  const fetchSequences = async () => {
    const { data, error } = await supabase
      .from('email_sequences')
      .select('id, name, description')
      .eq('status', 'active');
    
    if (error) {
      console.error(error);
      return;
    }
    setSequences(data || []);
  };

  const handleEnroll = async (sequenceId: string) => {
    if (!context) return;
    setEnrollLoading(sequenceId);
    
    try {
      // 1. Get first step delay
      const { data: steps } = await supabase
        .from('email_sequence_steps')
        .select('delay_hours')
        .eq('sequence_id', sequenceId)
        .eq('step_order', 1)
        .single();
      
      const delayHours = steps?.delay_hours || 0;
      const nextRun = new Date(Date.now() + (delayHours * 60 * 60 * 1000));

      // 2. Enroll
      const { error } = await supabase
        .from('email_sequence_enrollments')
        .insert({
          sequence_id: sequenceId,
          recipient_email: context.sender, // Assuming sender is who we enroll
          recipient_name: context.senderName,
          status: 'active',
          current_step_order: 0,
          next_step_due_at: nextRun.toISOString()
        });

      if (error) throw error;
      
      setEnrollSuccess(true);
      setIsSequenceModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to enroll.");
    } finally {
      setEnrollLoading(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><RefreshCw className="animate-spin text-primary" /></div>;
  }

  if (!session) {
    return (
      <div className="w-full h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center mb-6">
            <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Nexus Connect</h1>
            <p className="text-sm text-gray-500">Sign in to access logistics intelligence</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="you@company.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={authLoading}>
              {authLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              Sign In
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-white flex flex-col">
      <header className="bg-primary text-primary-foreground p-4 flex items-center justify-between shadow-sm">
        <h1 className="font-bold text-lg flex items-center gap-2">
          <Mail className="w-5 h-5" /> Nexus Connect
        </h1>
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary/80" onClick={fetchContext} title="Refresh Context">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </Button>
           <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary/80" onClick={handleLogout} title="Sign Out">
             <LogOut className="w-4 h-4" />
           </Button>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50/50">
        {error && (
           <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm flex items-start gap-2">
             <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
             <p>{error}</p>
           </div>
        )}
        
        {enrollSuccess && (
           <div className="p-4 rounded-lg bg-green-50 text-green-700 text-sm flex items-start gap-2">
             <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
             <p>Successfully enrolled {context?.senderName || context?.sender} in sequence.</p>
           </div>
        )}

        {context?.isEmailView ? (
          <>
            <Card className="border-l-4 border-l-primary shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Active Context
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-medium text-lg leading-tight mb-1">{context.subject}</div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{context.senderName}</span>
                  <span>&lt;{context.sender}&gt;</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-gray-700 px-1">Quick Actions</h3>
              
              <Dialog open={isSequenceModalOpen} onOpenChange={(open) => {
                setIsSequenceModalOpen(open);
                if (open) fetchSequences();
              }}>
                <DialogTrigger asChild>
                  <Button className="w-full justify-start h-10 shadow-sm" variant="outline">
                    <Play className="w-4 h-4 mr-2 text-blue-600" /> 
                    Add to Sequence
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add to Sequence</DialogTitle>
                    <DialogDescription>
                      Enroll <strong>{context.senderName || context.sender}</strong> in an automated email sequence.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-2 py-4 max-h-[300px] overflow-y-auto">
                    {sequences.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No active sequences found.</p>
                    ) : (
                      sequences.map(seq => (
                        <Button 
                          key={seq.id} 
                          variant="ghost" 
                          className="justify-between h-auto py-3 px-4 border"
                          onClick={() => handleEnroll(seq.id)}
                          disabled={!!enrollLoading}
                        >
                          <div className="text-left">
                            <div className="font-medium">{seq.name}</div>
                            {seq.description && <div className="text-xs text-muted-foreground">{seq.description}</div>}
                          </div>
                          {enrollLoading === seq.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4 text-blue-500" />
                          )}
                        </Button>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button 
                className="w-full justify-start h-10 shadow-sm" 
                variant={threatResult ? "secondary" : "outline"}
                onClick={checkCompliance}
                disabled={complianceLoading}
              >
                {complianceLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className={`w-4 h-4 mr-2 ${threatResult ? '' : 'text-green-600'}`} />
                )}
                {threatResult ? "Re-Check Compliance" : "Check Compliance"}
              </Button>

              {threatResult && (
                <div className={`mt-2 p-3 rounded-md text-sm border ${
                  threatResult.threat_level === 'safe' ? 'bg-green-50 border-green-200 text-green-800' :
                  threatResult.threat_level === 'suspicious' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                  'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="font-semibold capitalize flex items-center gap-2">
                    {threatResult.threat_level === 'safe' ? <ShieldCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {threatResult.threat_level} (Score: {threatResult.threat_score})
                  </div>
                  <p className="mt-1 text-xs opacity-90">{threatResult.reasoning}</p>
                  {threatResult.threat_type !== 'None' && (
                     <div className="mt-1 text-xs font-mono bg-white/50 px-1 rounded w-fit">Type: {threatResult.threat_type}</div>
                  )}
                </div>
              )}
            </div>
            
            <div className="text-xs text-gray-400 text-center pt-4">
              Context ID: {context.url.split('/').pop()?.substring(0, 12)}...
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center p-4">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <Mail className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No Email Selected</h3>
            <p className="text-sm text-gray-500 max-w-[200px]">
              Open an email in Gmail to see context-aware actions.
            </p>
          </div>
        )}
      </main>
      
      <footer className="p-3 border-t bg-white text-xs text-center text-gray-400 flex justify-between items-center">
        <span>v1.0.0</span>
        {session.user.email && (
          <span className="flex items-center gap-1" title={session.user.email}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {session.user.email.split('@')[0]}
          </span>
        )}
      </footer>
    </div>
  );
}
