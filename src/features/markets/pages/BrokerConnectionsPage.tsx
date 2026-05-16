/**
 * Markets — Broker Connections settings page.
 *
 * /dashboard/markets/settings/brokers
 *
 * Sections:
 *   1. Connected accounts — cards with status, last-synced, sync/disconnect actions
 *   2. Add a broker — grid of supported brokers; click to open the connect sheet
 *   3. Import-only brokers — shown differently with "Import holdings →" link
 *
 * Auth flows (handled in ConnectSheet):
 *   api_key      → single form (Dhan)
 *   totp         → single form (Angel One)
 *   session_token → 2-step: enter keys → get URL → paste session token (ICICI)
 *   oauth        → 2-step: enter keys → open URL → paste code (Fyers, Zerodha)
 *   otp          → 3-step: enter creds → send OTP → enter OTP (Kotak)
 */

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileDown,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Unplug,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SkeletonCard,
  Switch,
} from "@/components/ui";

import {
  AddConnectionInput,
  BrokerConnection,
  SupportedBroker,
  useAddBrokerConnection,
  useBrokerConnections,
  useExchangeBrokerCode,
  useRemoveBrokerConnection,
  useSupportedBrokers,
  useTriggerBrokerSync,
} from "../hooks/useBrokerConnections";

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BrokerConnection["status"] }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active:      { label: "Active",   variant: "default" },
    pending:     { label: "Pending",  variant: "secondary" },
    expired:     { label: "Expired",  variant: "destructive" },
    error:       { label: "Error",    variant: "destructive" },
    revoked:     { label: "Revoked",  variant: "outline" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
}

function StatusIcon({ status }: { status: BrokerConnection["status"] }) {
  if (status === "active")  return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "expired") return <Clock        className="h-4 w-4 text-amber-500" />;
  if (status === "error")   return <XCircle      className="h-4 w-4 text-destructive" />;
  return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
}

// ── Connection card ───────────────────────────────────────────────────────────

function ConnectionCard({
  conn,
  broker,
  onSync,
  onReauth,
  onRemove,
  isSyncing,
}: {
  conn:      BrokerConnection;
  broker?:   SupportedBroker;
  onSync:    () => void;
  onReauth:  () => void;
  onRemove:  () => void;
  isSyncing: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <StatusIcon status={conn.status} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{conn.display_name}</span>
                <StatusBadge status={conn.status} />
                {conn.can_trade && (
                  <Badge variant="secondary" className="text-xs">Trading</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {broker?.name ?? conn.broker} · Client {conn.broker_client_id}
              </p>
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                {conn.last_synced_at && (
                  <span>
                    Synced {formatDistanceToNow(new Date(conn.last_synced_at), { addSuffix: true })}
                  </span>
                )}
                {conn.token_expires_at && conn.status === "active" && (
                  <span>
                    Token expires {formatDistanceToNow(new Date(conn.token_expires_at), { addSuffix: true })}
                  </span>
                )}
              </div>
              {conn.segments?.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {conn.segments.map(s => (
                    <Badge key={s} variant="outline" className="text-xs px-1.5 py-0">{s}</Badge>
                  ))}
                </div>
              )}
              {conn.error_message && conn.status === "error" && (
                <p className="mt-1.5 text-xs text-destructive line-clamp-2">{conn.error_message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {conn.status === "active" && (
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={onSync} disabled={isSyncing} title="Sync now">
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              </Button>
            )}
            {(conn.status === "expired" || conn.status === "error") && (
              <Button variant="outline" size="sm" onClick={onReauth} className="h-8 text-xs">
                Re-authenticate
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onRemove} title="Disconnect">
              <Unplug className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Connect sheet ─────────────────────────────────────────────────────────────

interface ConnectSheetProps {
  broker:     SupportedBroker | null;
  open:       boolean;
  onClose:    () => void;
  onSuccess:  (conn: BrokerConnection) => void;
}

function ConnectSheet({ broker, open, onClose, onSuccess }: ConnectSheetProps) {
  const [step, setStep]       = useState(0);
  const [form, setForm]       = useState<Record<string, string>>({});
  const [authUrl, setAuthUrl] = useState("");
  const [canTrade, setCanTrade] = useState(false);

  const addConn     = useAddBrokerConnection();
  const exchangeCode = useExchangeBrokerCode();

  if (!broker) return null;

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const busy = addConn.isPending || exchangeCode.isPending;

  // ── Step definitions per auth type ────────────────────────────────────────

  async function handleSubmit() {
    if (!broker) return;

    try {
      if (broker.auth_type === "api_key") {
        // Dhan: client_id + access_token directly
        await finalise({
          client_id:    form.client_id,
          access_token: form.access_token,
        }, form.client_id);
      }

      else if (broker.auth_type === "totp") {
        // Angel One: store all creds; connect on server side
        await finalise({
          api_key:     form.api_key,
          client_id:   form.client_id,
          password:    form.password,
          totp_secret: form.totp_secret,
        }, form.client_id);
      }

      else if (broker.auth_type === "session_token") {
        if (step === 0) {
          // Step 1: fetch the login URL, show it to user
          const params = new URLSearchParams({
            broker:   broker.id,
            api_key:  form.api_key,
          });
          const res = await fetch(
            `${import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001"}/v1/brokers/auth-url?${params}`,
          );
          const data = await res.json();
          setAuthUrl(data.auth_url ?? "");
          setStep(1);
          return;
        }
        // Step 2: user pasted session token
        await finalise({
          api_key:       form.api_key,
          api_secret:    form.api_secret,
          session_token: form.session_token,
        }, form.client_id || form.api_key.slice(0, 8));
      }

      else if (broker.auth_type === "oauth") {
        if (step === 0) {
          // Step 1: get auth URL and open it
          const params = new URLSearchParams({
            broker:       broker.id,
            api_key:      form.api_key,
            redirect_uri: form.redirect_uri || "https://127.0.0.1/",
          });
          const res = await fetch(
            `${import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001"}/v1/brokers/auth-url?${params}`,
          );
          const data = await res.json();
          setAuthUrl(data.auth_url ?? "");
          window.open(data.auth_url, "_blank");
          setStep(1);
          return;
        }
        // Step 2: exchange auth code for tokens
        const result = await exchangeCode.mutateAsync({
          broker: broker.id,
          code:   form.auth_code,
          extra:  {
            api_key:      form.api_key,
            api_secret:   form.api_secret,
            redirect_uri: form.redirect_uri || "https://127.0.0.1/",
          },
        });
        await finalise({
          api_key:       form.api_key,
          api_secret:    form.api_secret,
          access_token:  result.access_token,
          refresh_token: result.refresh_token ?? "",
        }, form.client_id || form.api_key.slice(0, 8));
      }

      else if (broker.auth_type === "otp") {
        if (step === 0) {
          // Step 1: initiate OTP (call worker initiate endpoint)
          setStep(1);
          toast.info("OTP sent to your registered mobile number");
          return;
        }
        // Step 2: validate OTP + exchange for access token
        const result = await exchangeCode.mutateAsync({
          broker: broker.id,
          code:   form.otp,
          extra:  {
            consumer_key:    form.consumer_key,
            consumer_secret: form.consumer_secret,
            mobile_number:   form.mobile_number,
            password:        form.password,
            mpin:            form.mpin,
          },
        });
        await finalise({
          consumer_key:    form.consumer_key,
          consumer_secret: form.consumer_secret,
          mobile_number:   form.mobile_number,
          password:        form.password,
          mpin:            form.mpin,
          access_token:    result.access_token,
          sid:             result.extra?.sid ?? "",
          neo_fin_key:     result.extra?.neo_fin_key ?? "",
        }, form.mobile_number.slice(-4));
      }

    } catch (e: any) {
      toast.error(e?.message ?? "Connection failed");
    }
  }

  async function finalise(credentials: Record<string, string>, clientId: string) {
    if (!broker) return;
    const input: AddConnectionInput = {
      broker:           broker.id,
      broker_client_id: clientId,
      display_name:     form.display_name || `${broker.name} – ${clientId}`,
      credentials,
      segments:         broker.supports,
      can_trade:        canTrade,
    };
    const conn = await addConn.mutateAsync(input);
    toast.success(`${broker.name} connected`);
    onSuccess(conn);
    handleClose();
  }

  function handleClose() {
    setStep(0);
    setForm({});
    setAuthUrl("");
    setCanTrade(false);
    onClose();
  }

  // ── Field helpers ─────────────────────────────────────────────────────────

  const F = ({ id, label, type = "text", placeholder = "", hint = "" }: {
    id: string; label: string; type?: string; placeholder?: string; hint?: string;
  }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} placeholder={placeholder}
        value={form[id] ?? ""}
        onChange={e => set(id, e.target.value)}
        autoComplete="off"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  // ── Form body per auth type + step ────────────────────────────────────────

  const renderForm = () => {
    if (broker.auth_type === "api_key") return (
      <div className="space-y-4">
        <F id="display_name" label="Account label" placeholder={`My ${broker.name} account`} />
        <F id="client_id"    label="Client ID"     placeholder="Your Dhan client ID" />
        <F id="access_token" label="Access token"  type="password"
           placeholder="Paste from console.dhan.co → My Profile → Access Token"
           hint="Dhan tokens are long-lived — no daily re-auth needed." />
      </div>
    );

    if (broker.auth_type === "totp") return (
      <div className="space-y-4">
        <F id="display_name" label="Account label"    placeholder={`My ${broker.name} account`} />
        <F id="api_key"      label="API Key"          placeholder="From smartapi.angelbroking.com" />
        <F id="client_id"    label="Client ID"        placeholder="Angel One client ID (e.g. A123456)" />
        <F id="password"     label="Trading password" type="password" />
        <F id="totp_secret"  label="TOTP secret key"  type="password"
           placeholder="32-character base32 secret from QR code"
           hint="Found when you set up 2FA on Angel One. Enables automated daily token refresh." />
      </div>
    );

    if (broker.auth_type === "session_token") {
      if (step === 0) return (
        <div className="space-y-4">
          <F id="display_name" label="Account label"  placeholder={`My ${broker.name} account`} />
          <F id="client_id"    label="Client ID"      placeholder="Your ICICI Direct client ID" />
          <F id="api_key"      label="API Key"        placeholder="From ICICIdirect API portal" />
          <F id="api_secret"   label="API Secret"     type="password" />
          <p className="text-xs text-muted-foreground bg-muted p-3 rounded">
            Click Connect to generate your login URL. You'll be prompted to
            visit it, log in to ICICI Direct, and paste back the session token.
          </p>
        </div>
      );
      return (
        <div className="space-y-4">
          <div className="bg-muted rounded p-3 space-y-2">
            <p className="text-sm font-medium">Step 2 of 2 — Paste session token</p>
            <p className="text-xs text-muted-foreground">
              Visit the URL below, log in with your ICICI Direct credentials,
              and copy the <code>token</code> value from the redirect URL.
            </p>
            {authUrl && (
              <a href={authUrl} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1 text-xs text-primary hover:underline break-all">
                Open ICICI Direct login <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            )}
          </div>
          <F id="session_token" label="Session token" type="password"
             placeholder="Paste token= value from redirect URL" />
        </div>
      );
    }

    if (broker.auth_type === "oauth") {
      if (step === 0) return (
        <div className="space-y-4">
          <F id="display_name"  label="Account label"  placeholder={`My ${broker.name} account`} />
          <F id="client_id"     label="Client ID"      placeholder="Your broker client ID" />
          <F id="api_key"       label="API Key"        placeholder={broker.id === "zerodha" ? "Kite API Key" : "App ID (XXXXX-100)"} />
          <F id="api_secret"    label="Secret / API Secret" type="password" />
          {broker.id === "fyers" && (
            <F id="redirect_uri" label="Redirect URI"  placeholder="https://127.0.0.1/"
               hint="Must match the redirect URI registered in your Fyers app." />
          )}
          <p className="text-xs text-muted-foreground bg-muted p-3 rounded">
            Click Connect to open the {broker.name} login page in a new tab.
            After authorising, paste the code from the redirect URL.
          </p>
        </div>
      );
      return (
        <div className="space-y-4">
          <div className="bg-muted rounded p-3 space-y-2">
            <p className="text-sm font-medium">Step 2 of 2 — Enter auth code</p>
            <p className="text-xs text-muted-foreground">
              {broker.id === "zerodha"
                ? "Copy the request_token= value from the redirect URL."
                : "Copy the auth_code= value from the redirect URL."}
            </p>
            {authUrl && (
              <button onClick={() => window.open(authUrl, "_blank")}
                className="flex items-center gap-1 text-xs text-primary hover:underline">
                Re-open {broker.name} login <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
          <F id="auth_code" label={broker.id === "zerodha" ? "Request token" : "Auth code"}
             type="password" placeholder="Paste from redirect URL" />
        </div>
      );
    }

    if (broker.auth_type === "otp") {
      if (step === 0) return (
        <div className="space-y-4">
          <F id="display_name"     label="Account label"   placeholder={`My ${broker.name} account`} />
          <F id="consumer_key"     label="Consumer Key"    placeholder="From Neo API developer portal" />
          <F id="consumer_secret"  label="Consumer Secret" type="password" />
          <F id="mobile_number"    label="Mobile number"   placeholder="10-digit registered mobile" />
          <F id="password"         label="Neo password"    type="password" />
          <F id="mpin"             label="MPIN"            type="password" placeholder="6-digit MPIN" />
          <p className="text-xs text-muted-foreground bg-muted p-3 rounded">
            Click Send OTP to trigger a one-time password to your registered mobile.
          </p>
        </div>
      );
      return (
        <div className="space-y-4">
          <div className="bg-muted rounded p-3">
            <p className="text-sm font-medium">Step 2 of 2 — Enter OTP</p>
            <p className="text-xs text-muted-foreground mt-1">
              Enter the OTP sent to {form.mobile_number ?? "your registered mobile"}.
            </p>
          </div>
          <F id="otp" label="OTP" placeholder="6-digit OTP" />
        </div>
      );
    }

    return null;
  };

  const submitLabel = () => {
    if (busy) return <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting…</>;
    if (broker.auth_type === "session_token" && step === 0) return "Get login URL";
    if (broker.auth_type === "oauth"         && step === 0) return "Open login page";
    if (broker.auth_type === "otp"           && step === 0) return "Send OTP";
    return "Connect";
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Connect {broker.name}</SheetTitle>
          <SheetDescription>
            {broker.data_cost === "Free"
              ? "Free API access — no subscription required."
              : `Data: ${broker.data_cost}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {renderForm()}

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="can-trade" className="text-sm">Enable live trading</Label>
              <p className="text-xs text-muted-foreground">
                Allow order placement from this platform
              </p>
            </div>
            <Switch id="can-trade" checked={canTrade} onCheckedChange={setCanTrade} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={busy}>
              {submitLabel()}
            </Button>
          </div>

          {(addConn.isError || exchangeCode.isError) && (
            <p className="text-xs text-destructive">
              {addConn.error?.message ?? exchangeCode.error?.message}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BrokerConnectionsPage() {
  const connections     = useBrokerConnections();
  const supportedQuery  = useSupportedBrokers();
  const removeConn      = useRemoveBrokerConnection();
  const triggerSync     = useTriggerBrokerSync();

  const [selectedBroker, setSelectedBroker] = useState<SupportedBroker | null>(null);
  const [removeId, setRemoveId]             = useState<string | null>(null);
  const [syncingId, setSyncingId]           = useState<string | null>(null);
  const [reauthBroker, setReauthBroker]     = useState<SupportedBroker | null>(null);

  const supported   = supportedQuery.data ?? [];
  const fullApi     = supported.filter(b => b.tier === "full_api");
  const importOnly  = supported.filter(b => b.tier === "import_only");
  const connected   = connections.data ?? [];
  const connIds     = new Set(connected.map(c => c.broker));

  const brokerMeta = (broker: string) =>
    supported.find(b => b.id === broker);

  async function handleSync(connectionId: string) {
    setSyncingId(connectionId);
    try {
      await triggerSync.mutateAsync(connectionId);
      toast.success("Sync triggered");
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed");
    } finally {
      setTimeout(() => setSyncingId(null), 3000);
    }
  }

  async function handleRemove() {
    if (!removeId) return;
    try {
      await removeConn.mutateAsync(removeId);
      toast.success("Broker disconnected");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to disconnect");
    } finally {
      setRemoveId(null);
    }
  }

  function handleReauth(conn: BrokerConnection) {
    const meta = brokerMeta(conn.broker);
    if (meta) setReauthBroker(meta);
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-semibold">Broker Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Connect your trading accounts for live portfolio sync and order placement.
          </p>
        </div>

        {/* ── Connected accounts ─────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
            Connected accounts
          </h2>
          {connections.isPending && <SkeletonCard lines={3} />}
          {connections.isError && (
            <ErrorState title="Could not load connections"
              message={connections.error?.message} onRetry={() => connections.refetch()} />
          )}
          {connections.isSuccess && connected.length === 0 && (
            <EmptyState
              icon={<WifiOff className="h-10 w-10" />}
              title="No accounts connected"
              description="Connect a broker account to sync your holdings, positions, and orders automatically."
            />
          )}
          {connected.length > 0 && (
            <div className="space-y-3">
              {connected.map(conn => (
                <ConnectionCard
                  key={conn.id}
                  conn={conn}
                  broker={brokerMeta(conn.broker)}
                  onSync={() => handleSync(conn.id)}
                  onReauth={() => handleReauth(conn)}
                  onRemove={() => setRemoveId(conn.id)}
                  isSyncing={syncingId === conn.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Add a broker ───────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
            Add a broker account
          </h2>
          {supportedQuery.isPending && <SkeletonCard lines={2} />}
          {fullApi.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fullApi.map(broker => {
                const alreadyConnected = connIds.has(broker.id);
                return (
                  <button
                    key={broker.id}
                    onClick={() => setSelectedBroker(broker)}
                    className="text-left p-4 rounded-lg border hover:border-primary hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{broker.name}</span>
                          {alreadyConnected && (
                            <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {broker.data_cost}
                        </p>
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {broker.supports.map(s => (
                            <span key={s}
                              className="text-[10px] px-1.5 py-0 rounded border bg-muted text-muted-foreground">
                              {s}
                            </span>
                          ))}
                        </div>
                        {broker.refresh === "automated" && (
                          <p className="text-[10px] text-emerald-600 mt-1">✓ Auto token refresh</p>
                        )}
                        {broker.refresh === "none" && (
                          <p className="text-[10px] text-emerald-600 mt-1">✓ Token never expires</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Import-only brokers ─────────────────────────────────────── */}
        {importOnly.length > 0 && (
          <section>
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Import-only accounts
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              These brokers don't offer a public trading API. Import your holdings
              via a statement file instead.
            </p>
            <div className="space-y-2">
              {importOnly.map(broker => (
                <div key={broker.id}
                  className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <span className="text-sm font-medium">{broker.name}</span>
                    {broker.import_note && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {broker.import_note}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild className="shrink-0 gap-1.5">
                    <a href="/dashboard/markets/portfolios">
                      <FileDown className="h-3.5 w-3.5" />
                      Import holdings
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* ── Connect sheet ─────────────────────────────────────────────── */}
      <ConnectSheet
        broker={selectedBroker ?? reauthBroker}
        open={Boolean(selectedBroker) || Boolean(reauthBroker)}
        onClose={() => { setSelectedBroker(null); setReauthBroker(null); }}
        onSuccess={() => { setSelectedBroker(null); setReauthBroker(null); }}
      />

      {/* ── Disconnect confirm ─────────────────────────────────────────── */}
      <AlertDialog open={Boolean(removeId)} onOpenChange={v => { if (!v) setRemoveId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect broker account?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the API credentials and deletes all synced position data for
              this connection. Holdings and transaction history are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
