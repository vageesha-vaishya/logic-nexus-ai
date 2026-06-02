// Platform-admin page that surfaces the unified LLM gateway state.
// Three tabs:
//   - Prompts      list of seeded prompt keys + active version + version count
//   - Experiments  active + completed A/B experiments with verdict
//   - Audit        recent invocations (filterable by prompt_key + status)
//
// Auth: gated by PLATFORM_ADMIN_ROLE at the route layer (App.tsx).
// Data: comes through the llm-admin-list edge fn which proxies the
// gateway's /v1/admin/* endpoints with a service token.

import { useState } from 'react';
import { Loader2, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
  useAdminPromptList,
  useAdminExperimentList,
  useAdminAuditList,
} from '@/features/admin/llm-gateway/useLlmGatewayLists';

function ErrorBox({ err }: { err: unknown }) {
  const message = err instanceof Error ? err.message : String(err);
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">Couldn't load this list.</p>
        <p className="text-xs">{message}</p>
      </div>
    </div>
  );
}

function PromptsTab() {
  const q = useAdminPromptList();
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Seeded prompts</h2>
          <p className="text-xs text-muted-foreground">
            Every prompt-key the gateway knows about. Click a callsite in your code to update; this list is read-only.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
      {q.isError && <ErrorBox err={q.error} />}
      {q.data?.note && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{q.data.note}</p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Module / feature</TableHead>
            <TableHead>Capability</TableHead>
            <TableHead>Safety</TableHead>
            <TableHead className="text-right">Versions</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(q.data?.items ?? []).map((p) => (
            <TableRow key={p.key}>
              <TableCell className="font-mono text-xs">{p.key}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {p.module} <span className="opacity-50">/</span> {p.feature}
              </TableCell>
              <TableCell className="text-xs">{p.default_capability ?? '—'}</TableCell>
              <TableCell>
                {p.safety_class && (
                  <Badge variant={p.safety_class === 'restricted' ? 'destructive' : 'secondary'}>
                    {p.safety_class}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{p.total_versions}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {p.updated_at ? format(new Date(p.updated_at), 'yyyy-MM-dd HH:mm') : '—'}
              </TableCell>
            </TableRow>
          ))}
          {q.isSuccess && (q.data?.items.length ?? 0) === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No prompts yet.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function ExperimentsTab() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const q = useAdminExperimentList(statusFilter === 'all' ? undefined : statusFilter);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Prompt experiments</h2>
          <p className="text-xs text-muted-foreground">A/B variants live or recently concluded. Chi-square verdict + sample size shown when available.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="evaluated">Evaluated</SelectItem>
              <SelectItem value="promoted">Promoted</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {q.isError && <ErrorBox err={q.error} />}
      {q.data?.note && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{q.data.note}</p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Prompt</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Traffic split</TableHead>
            <TableHead className="text-right">Sample size</TableHead>
            <TableHead>Verdict</TableHead>
            <TableHead>Started</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(q.data?.items ?? []).map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-xs">{e.prompt_key}</TableCell>
              <TableCell>
                <Badge variant={e.status === 'active' ? 'default' : 'secondary'}>{e.status}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{Math.round((e.traffic_split ?? 0) * 100)}%</TableCell>
              <TableCell className="text-right tabular-nums">{e.sample_size ?? '—'}</TableCell>
              <TableCell className="text-xs">{e.verdict ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {e.started_at ? format(new Date(e.started_at), 'yyyy-MM-dd HH:mm') : '—'}
              </TableCell>
            </TableRow>
          ))}
          {q.isSuccess && (q.data?.items.length ?? 0) === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No experiments.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function AuditTab() {
  const [promptKey, setPromptKey] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [limit, setLimit] = useState<number>(50);
  const q = useAdminAuditList({
    prompt_key: promptKey.trim() || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit,
  });
  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Recent invocations</h2>
          <p className="text-xs text-muted-foreground">Latest {limit} rows from gateway.invocation_audit, filterable.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">Prompt key</label>
            <Input
              value={promptKey}
              onChange={(e) => setPromptKey(e.target.value)}
              placeholder="e.g. compliance.screening.hit_reasoning"
              className="h-8 text-xs w-[280px]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="succeeded">Succeeded</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="rejected_safety">Rejected (safety)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">Limit</label>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-[80px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {q.isError && <ErrorBox err={q.error} />}
      {q.data?.note && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{q.data.note}</p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Prompt</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Latency</TableHead>
            <TableHead className="text-right">Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(q.data?.items ?? []).map((a) => (
            <TableRow key={a.id}>
              <TableCell className="text-xs text-muted-foreground tabular-nums">
                {a.ts ? format(new Date(a.ts), 'HH:mm:ss') : '—'}
              </TableCell>
              <TableCell className="font-mono text-xs">{a.prompt_key ?? '—'}</TableCell>
              <TableCell className="text-xs">{a.provider_kind ?? '—'}</TableCell>
              <TableCell className="text-xs">{a.model_id ?? '—'}</TableCell>
              <TableCell>
                <Badge variant={
                  a.status === 'succeeded' ? 'default' :
                  a.status === 'failed' ? 'destructive' : 'secondary'
                }>
                  {a.status}
                  {a.error_code ? ` · ${a.error_code}` : ''}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">{a.latency_ms ?? '—'} ms</TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {a.cost_usd != null ? `$${a.cost_usd.toFixed(4)}` : '—'}
              </TableCell>
            </TableRow>
          ))}
          {q.isSuccess && (q.data?.items.length ?? 0) === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">No invocations match the current filters.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function LlmGatewayAdminPage() {
  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">LLM Gateway</h1>
        <span className="text-xs text-muted-foreground">read-only operator view</span>
      </header>

      <Tabs defaultValue="prompts">
        <TabsList>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="experiments">Experiments</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="prompts" className="mt-3"><PromptsTab /></TabsContent>
        <TabsContent value="experiments" className="mt-3"><ExperimentsTab /></TabsContent>
        <TabsContent value="audit" className="mt-3"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}
