import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useCRM } from "@/hooks/useCRM";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";

type ProviderPreset = "gmail" | "office365" | "yahoo" | "zoho" | "custom";

interface SMTPSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  use_tls: boolean;
}

interface IMAPSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  use_ssl: boolean;
}

interface EmailAccountForm {
  display_name: string;
  email_address: string;
  preset: ProviderPreset;
  smtp: SMTPSettings;
  imap: IMAPSettings;
  is_primary: boolean;
}

const PRESETS: Record<ProviderPreset, { smtp: Partial<SMTPSettings>; imap: Partial<IMAPSettings> }> = {
  gmail: {
    smtp: { host: "smtp.gmail.com", port: 587, use_tls: true },
    imap: { host: "imap.gmail.com", port: 993, use_ssl: true },
  },
  office365: {
    smtp: { host: "smtp.office365.com", port: 587, use_tls: true },
    imap: { host: "outlook.office365.com", port: 993, use_ssl: true },
  },
  yahoo: {
    smtp: { host: "smtp.mail.yahoo.com", port: 465, use_tls: true },
    imap: { host: "imap.mail.yahoo.com", port: 993, use_ssl: true },
  },
  zoho: {
    smtp: { host: "smtp.zoho.com", port: 587, use_tls: true },
    imap: { host: "imap.zoho.com", port: 993, use_ssl: true },
  },
  custom: {
    smtp: {},
    imap: {},
  },
};

type DBEmailAccount = {
  id: string;
  provider: "smtp_imap" | "gmail" | "office365" | "other";
  email_address: string;
  display_name: string | null;
  is_primary: boolean | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_use_tls: boolean | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_username: string | null;
  imap_password: string | null;
  imap_use_ssl: boolean | null;
};

function emptyForm(): EmailAccountForm {
  return {
    display_name: "",
    email_address: "",
    preset: "gmail",
    smtp: { host: "", port: 587, username: "", password: "", use_tls: true },
    imap: { host: "", port: 993, username: "", password: "", use_ssl: true },
    is_primary: false,
  };
}

export const EmailClientSettings: React.FC = () => {
  const { context } = useCRM();
  type EmailAccountRow = Tables<"email_accounts">;
  const [accounts, setAccounts] = useState<EmailAccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [verification, setVerification] = useState<Record<string, { verified: boolean; method?: string; checkedAt?: string }>>({});
  const [form, setForm] = useState<EmailAccountForm>(emptyForm());

  const canEdit = useMemo(() => !!context?.tenantId || context?.isPlatformAdmin, [context]);

  useEffect(() => {
    const loadAccounts = async () => {
      setLoading(true);
      const query = supabase
        .from("email_accounts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      setLoading(false);
      if (error) {
        toast({ title: "Failed to load email accounts", description: error.message, variant: "destructive" });
        return;
      }
      setAccounts((data as EmailAccountRow[]) || []);
    };
    loadAccounts();
  }, []);

  useEffect(() => {
    // Apply preset when changed
    const presetValues = PRESETS[form.preset];
    setForm((prev) => ({
      ...prev,
      smtp: {
        ...prev.smtp,
        host: presetValues.smtp.host ?? prev.smtp.host,
        port: presetValues.smtp.port ?? prev.smtp.port,
        use_tls: presetValues.smtp.use_tls ?? prev.smtp.use_tls,
      },
      imap: {
        ...prev.imap,
        host: presetValues.imap.host ?? prev.imap.host,
        port: presetValues.imap.port ?? prev.imap.port,
        use_ssl: presetValues.imap.use_ssl ?? prev.imap.use_ssl,
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.preset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data: authData, error: userError } = await supabase.auth.getUser();
    if (userError || !authData?.user) {
      setSaving(false);
      toast({ title: "Not signed in", description: "Please sign in to save email settings.", variant: "destructive" });
      return;
    }
    const userId = authData.user.id;

    const payload: TablesInsert<"email_accounts"> = {
      user_id: userId,
      provider: "smtp_imap",
      email_address: form.email_address,
      display_name: form.display_name || null,
      is_primary: form.is_primary,
      smtp_host: form.smtp.host,
      smtp_port: form.smtp.port,
      smtp_username: form.smtp.username,
      smtp_password: form.smtp.password,
      smtp_use_tls: form.smtp.use_tls,
      imap_host: form.imap.host,
      imap_port: form.imap.port,
      imap_username: form.imap.username,
      imap_password: form.imap.password,
      imap_use_ssl: form.imap.use_ssl,
      tenant_id: context?.tenantId ?? null,
      franchise_id: context?.franchiseId ?? null,
      is_active: true,
      settings: { preset: form.preset },
    };

    const { error } = await supabase.from("email_accounts").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Failed to save account", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Email account saved", description: "SMTP/IMAP settings stored successfully." });
    setForm(emptyForm());
    // refresh list
    const { data } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setAccounts((data as EmailAccountRow[]) || []);
  };

  const sendTestEmail = async (account: EmailAccountRow) => {
    try {
      if (String(account.provider) === 'smtp_imap') {
        toast({
          title: 'SMTP/IMAP Not Supported',
          description: 'Direct SMTP/IMAP is blocked in cloud environments. Please use Gmail or Office 365 OAuth connection from the Accounts tab for full email functionality (send & receive).',
          variant: 'destructive',
        });
        return;
      }
      setTestingId(account.id as string);
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          accountId: account.id,
          to: [account.email_address],
          cc: [],
          bcc: [],
          subject: "Test Email",
          body: "This is a test email to verify configuration.",
        },
      });
      if (error) throw error as any;
      const verified = Boolean(data?.verified);
      const method = typeof data?.verificationMethod === "string" ? String(data?.verificationMethod) : undefined;
      const checkedAt = typeof data?.verificationCheckedAt === "string" ? String(data?.verificationCheckedAt) : undefined;
      setVerification((prev) => ({
        ...prev,
        [String(account.id)]: { verified, method, checkedAt },
      }));
      toast({
        title: verified ? "Test email delivered" : "Test email sent",
        description: verified
          ? `Verified delivery to ${account.email_address}`
          : `Sent to ${account.email_address}. Waiting for provider confirmation...`,
      });
    } catch (error: any) {
      const msg = error?.message || 'Failed to send test';
      toast({ title: "Failed to send test", description: msg, variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  };

  const mask = (v?: string | null) => (v ? "••••••••" : "");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SMTP/IMAP Email Client</CardTitle>
          <CardDescription>Configure Gmail, Outlook, and other providers using direct SMTP/IMAP.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Provider preset</Label>
                <Select value={form.preset} onValueChange={(v) => setForm((f) => ({ ...f, preset: v as ProviderPreset }))}>
                  <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail</SelectItem>
                    <SelectItem value="office365">Outlook (Office365)</SelectItem>
                    <SelectItem value="yahoo">Yahoo</SelectItem>
                    <SelectItem value="zoho">Zoho</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Display name</Label>
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="e.g. Sales Team"
                />
              </div>

              <div className="space-y-2">
                <Label>Email address</Label>
                <Input
                  type="email"
                  value={form.email_address}
                  onChange={(e) => setForm((f) => ({ ...f, email_address: e.target.value }))}
                  placeholder="name@domain.com"
                  required
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={form.is_primary} onCheckedChange={(v) => setForm((f) => ({ ...f, is_primary: v }))} />
                <Label>Set as primary sending account</Label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>SMTP host</Label>
                <Input value={form.smtp.host} onChange={(e) => setForm((f) => ({ ...f, smtp: { ...f.smtp, host: e.target.value } }))} placeholder="smtp.example.com" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>SMTP port</Label>
                  <Input type="number" value={form.smtp.port} onChange={(e) => setForm((f) => ({ ...f, smtp: { ...f.smtp, port: Number(e.target.value) } }))} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch checked={form.smtp.use_tls} onCheckedChange={(v) => setForm((f) => ({ ...f, smtp: { ...f.smtp, use_tls: v } }))} />
                  <Label>Use TLS</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>SMTP username</Label>
                  <Input value={form.smtp.username} onChange={(e) => setForm((f) => ({ ...f, smtp: { ...f.smtp, username: e.target.value } }))} />
                </div>
                <div className="space-y-2">
                  <Label>SMTP password</Label>
                  <Input type="password" value={form.smtp.password} onChange={(e) => setForm((f) => ({ ...f, smtp: { ...f.smtp, password: e.target.value } }))} />
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <Label>IMAP host</Label>
                <Input value={form.imap.host} onChange={(e) => setForm((f) => ({ ...f, imap: { ...f.imap, host: e.target.value } }))} placeholder="imap.example.com" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>IMAP port</Label>
                  <Input type="number" value={form.imap.port} onChange={(e) => setForm((f) => ({ ...f, imap: { ...f.imap, port: Number(e.target.value) } }))} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch checked={form.imap.use_ssl} onCheckedChange={(v) => setForm((f) => ({ ...f, imap: { ...f.imap, use_ssl: v } }))} />
                  <Label>Use SSL</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>IMAP username</Label>
                  <Input value={form.imap.username} onChange={(e) => setForm((f) => ({ ...f, imap: { ...f.imap, username: e.target.value } }))} />
                </div>
                <div className="space-y-2">
                  <Label>IMAP password</Label>
                  <Input type="password" value={form.imap.password} onChange={(e) => setForm((f) => ({ ...f, imap: { ...f.imap, password: e.target.value } }))} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={!canEdit || saving}>{saving ? "Saving..." : "Save Settings"}</Button>
                <Button type="button" variant="secondary" onClick={() => setForm(emptyForm())}>Reset</Button>
              </div>
              {!canEdit && (
                <p className="text-sm text-muted-foreground">You need a tenant or platform admin role to edit settings.</p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured Accounts</CardTitle>
          <CardDescription>Active SMTP/IMAP accounts available for sending and syncing.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading accounts...</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No SMTP/IMAP accounts configured yet.</p>
          ) : (
            <div className="space-y-3">
              {accounts.map((a) => (
                <div key={a.id} className="rounded border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{a.display_name || a.email_address}</p>
                      <p className="text-sm text-muted-foreground">{a.email_address} • {a.provider}</p>
                    </div>
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={testingId === (a.id as string)}
                        onClick={() => sendTestEmail(a)}
                      >
                        {testingId === (a.id as string) ? "Sending..." : "Send Test Email"}
                      </Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-sm">
                  <div>
                    <span className="font-medium">SMTP</span>
                    <div className="text-muted-foreground">{a.smtp_host}:{a.smtp_port} • TLS {String(a.smtp_use_tls)}</div>
                    <div className="text-muted-foreground">{a.smtp_username} / {mask(a.smtp_password)}</div>
                  </div>
                  <div>
                    <span className="font-medium">IMAP</span>
                    <div className="text-muted-foreground">{a.imap_host}:{a.imap_port} • SSL {String(a.imap_use_ssl)}</div>
                    <div className="text-muted-foreground">{a.imap_username} / {mask(a.imap_password)}</div>
                  </div>
                </div>
                {verification[String(a.id)] && (
                  <div className="mt-2 rounded bg-muted p-2 text-sm">
                    <div className="font-medium">Verification Details</div>
                    <div className="text-muted-foreground">
                      Method: {verification[String(a.id)].method || "—"}
                    </div>
                    <div className="text-muted-foreground">
                      Checked: {verification[String(a.id)].checkedAt ? new Date(verification[String(a.id)].checkedAt!).toLocaleString() : "—"}
                    </div>
                    <div className={verification[String(a.id)].verified ? "text-green-600" : "text-amber-600"}>
                      Status: {verification[String(a.id)].verified ? "Delivered (verified)" : "Sent (not yet verified)"}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      </Card>
    </div>
  );
};

export default EmailClientSettings;