import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { logger } from '@/lib/logger';
import PortalCopilot from '@/components/portal/PortalCopilot';

type QuoteRecord = {
  id: string;
  quote_number: string | null;
  status: string | null;
  created_at: string;
  accounts?: { name?: string } | null;
  contact_id?: string | null;
  sell_price?: number | null;
  buy_price?: number | null;
  currency_code?: string | null;
  notes?: string | null;
};

export default function QuotePortal() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [accepting, setAccepting] = useState(false);

  const fetchQuote = async (tkn?: string) => {
    const useToken = tkn ?? token;
    if (!useToken) {
      setError('Missing access token');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const { data, error: rpcError } = await (supabase as any).rpc('get_quote_by_token', { p_token: useToken });
      if (rpcError) throw rpcError;
      if (!data || (data as any).error) {
        const message = (data as any)?.error || 'Unable to load quote';
        setError(message);
        setQuote(null);
      } else {
        const q = (data as any).quote as QuoteRecord;
        setQuote(q);
      }
    } catch (e: any) {
      logger.error('Error fetching quote by token', {
        error: e.message,
        stack: e.stack,
        token: useToken,
        component: 'QuotePortal'
      });
      setError(e.message || 'An error occurred');
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const last = sessionStorage.getItem(`portal_last_${token}`);
    const now = Date.now();
    if (!last || now - Number(last) > 5000) {
      sessionStorage.setItem(`portal_last_${token}`, String(now));
      fetchQuote();
    } else {
      setError('Please wait a moment before refreshing');
      setLoading(false);
    }
  }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchQuote(token);
    setRefreshing(false);
  };

  const getClientIp = async (): Promise<string | null> => {
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      const j = await r.json();
      return j?.ip || null;
    } catch {
      return null;
    }
  };

  const onAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const ip = await getClientIp();
      const ua = navigator.userAgent;
      const { data, error: rpcError } = await (supabase as any).rpc('accept_quote_by_token', {
        p_token: token,
        p_decision: 'accepted',
        p_name: name || null,
        p_email: email || null,
        p_ip: ip || null,
        p_user_agent: ua || null
      });
      if (rpcError) throw rpcError;
      if (data?.error) {
        setError(data.error);
      } else {
        await fetchQuote(token);
        setAcceptOpen(false);
        setName('');
        setEmail('');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to submit decision');
    } finally {
      setAccepting(false);
    }
  };

  const downloadPDF = () => {
    if (!quote) return;
    try {
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Quote</title>
        <style>
          :root{--brand:#0ea5e9}
          body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica Neue,sans-serif;padding:24px;color:#111;background:#fff}
          header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
          .brand{font-weight:700;color:var(--brand)}
          h1{font-size:22px;margin:0}
          table{width:100%;border-collapse:collapse;margin-top:12px}
          th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}
          .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
          .label{font-size:11px;color:#666;margin-bottom:2px}
          .value{font-size:13px;font-weight:600}
          footer{margin-top:20px;font-size:11px;color:#666}
        </style>
      </head><body>
        <header>
          <div class="brand">SOS Logistics</div>
          <div>Quote ${quote.quote_number ? `#${quote.quote_number}` : ''}</div>
        </header>
        <div class="meta">
          <div><div class="label">Customer</div><div class="value">${quote.accounts?.name || '—'}</div></div>
          <div><div class="label">Status</div><div class="value">${quote.status || 'draft'}</div></div>
          <div><div class="label">Created</div><div class="value">${new Date(quote.created_at).toLocaleString()}</div></div>
          <div><div class="label">Total</div><div class="value">${quote.currency_code || 'USD'} ${typeof quote.sell_price === 'number' ? quote.sell_price.toFixed(2) : '—'}</div></div>
        </div>
        <table>
          <thead><tr><th>Section</th><th>Details</th></tr></thead>
          <tbody>
            <tr><td>Notes</td><td>${quote.notes || ''}</td></tr>
          </tbody>
        </table>
        <footer>Generated by SOS Logistics Customer Portal</footer>
      </body></html>`;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    } catch {
      return;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading quote...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-10">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-center gap-2 mb-6 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Secure Customer Portal
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Unable to load</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {quote && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Quote {quote.quote_number ? `#${quote.quote_number}` : ''}</CardTitle>
              <CardDescription>View the details of your sales quotation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{quote.accounts?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{quote.status || 'draft'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">{new Date(quote.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-medium">
                    {quote.currency_code || 'USD'} {typeof quote.sell_price === 'number' ? quote.sell_price.toFixed(2) : '—'}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-line">{quote.notes || '—'}</p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Refresh
                </Button>
                <Button variant="outline" onClick={downloadPDF}>
                  PDF
                </Button>
                <Button className="gap-2" onClick={() => setAcceptOpen(true)} disabled={accepting}>
                  <CheckCircle2 className="h-4 w-4" />
                  Accept Quote
                </Button>
              </div>

              <Separator />
              <PortalCopilot token={token} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export function AcceptDialog({
  open,
  onOpenChange,
  name,
  setName,
  email,
  setEmail,
  onConfirm,
  loading
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Acceptance</DialogTitle>
          <DialogDescription>Provide your details to confirm acceptance.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
