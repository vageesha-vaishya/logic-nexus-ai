// FinanceAccountingSetupPage — admin surface for the chart of
// accounts + tenant tax rules. Both data sources back the
// InvoiceLineClassifyPanel; without them, the LLM has no real GL
// codes to classify lines against.

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { useCRM } from '@/hooks/useCRM';
import {
  useGlAccounts,
  useCreateGlAccount,
  useSeedDefaultChart,
  type GlAccountType,
} from '../hooks/useGlAccounts';
import {
  useTenantTaxRules,
  useApplyTaxPreset,
  useUpdateTenantTaxRules,
  type TaxLabel,
} from '../hooks/useTenantTaxRules';

const GL_TYPE_OPTIONS: GlAccountType[] = [
  'revenue', 'cost_of_sales', 'expense',
  'pass_through_liability', 'tax_payable', 'tax_receivable', 'other',
];

const PRESET_JURISDICTIONS = ['IN', 'US', 'DE', 'NL', 'FR', 'GB', 'AE', 'SG'];

const GL_TYPE_VARIANT: Record<GlAccountType, 'default' | 'secondary' | 'outline'> = {
  revenue: 'default',
  cost_of_sales: 'secondary',
  expense: 'secondary',
  pass_through_liability: 'outline',
  tax_payable: 'outline',
  tax_receivable: 'outline',
  other: 'outline',
};

export default function FinanceAccountingSetupPage() {
  const { context } = useCRM();
  const tenantId = context?.tenantId ?? null;

  const accountsQuery = useGlAccounts(false);
  const createAccount = useCreateGlAccount();
  const seedChart = useSeedDefaultChart();

  const taxQuery = useTenantTaxRules();
  const applyPreset = useApplyTaxPreset();
  const updateTaxRules = useUpdateTenantTaxRules();

  // Create-account form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<GlAccountType>('revenue');
  const [tags, setTags] = useState('');
  const [presetJurisdiction, setPresetJurisdiction] = useState('IN');

  const accounts = accountsQuery.data ?? [];
  const taxRules = taxQuery.data ?? null;

  const handleCreate = async () => {
    if (!code.trim() || !name.trim()) {
      toast.error('Code and name are required');
      return;
    }
    await createAccount.mutateAsync({
      code: code.trim(),
      name: name.trim(),
      type,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setCode('');
    setName('');
    setTags('');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 lg:p-6">
        <div>
          <h1 className="text-2xl font-bold">Accounting Setup</h1>
          <p className="text-sm text-muted-foreground">
            Configure the chart of accounts + tax rules that back AI-assisted invoice classification.
          </p>
        </div>

        {/* ── Tax rules card ───────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tax Rules</CardTitle>
            <CardDescription>
              Tenant-wide tax configuration. Applies to every invoice classified by AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {taxQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tax rules…
              </div>
            ) : !taxRules ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  No tax rules configured yet
                </div>
                <p className="text-xs text-amber-900 dark:text-amber-200 mb-3">
                  Pick a jurisdiction preset to get started. You can tweak the details afterwards.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={presetJurisdiction} onValueChange={setPresetJurisdiction}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_JURISDICTIONS.map((j) => (
                        <SelectItem key={j} value={j}>{j}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!tenantId || applyPreset.isPending}
                    onClick={() => tenantId && applyPreset.mutate({ tenantId, jurisdiction: presetJurisdiction })}
                  >
                    {applyPreset.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Applying…</>
                    ) : (
                      <>Apply preset</>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Jurisdiction</div>
                    <div className="font-mono">{taxRules.jurisdiction}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Tax label</div>
                    <Badge variant="secondary">{taxRules.tax_label}</Badge>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Default rate</div>
                    <div>{taxRules.default_rate_pct != null ? `${taxRules.default_rate_pct}%` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Updated</div>
                    <div className="text-xs">{new Date(taxRules.updated_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Zero-rated charges</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {taxRules.zero_rated_charges.length === 0
                      ? <span className="text-xs italic text-muted-foreground/70">None</span>
                      : taxRules.zero_rated_charges.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                        ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Reverse-charge codes</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {taxRules.reverse_charge_applicable_codes.length === 0
                      ? <span className="text-xs italic text-muted-foreground/70">None</span>
                      : taxRules.reverse_charge_applicable_codes.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                        ))}
                  </div>
                </div>
                <Separator />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Switch preset:</span>
                  <Select value={presetJurisdiction} onValueChange={setPresetJurisdiction}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_JURISDICTIONS.map((j) => (
                        <SelectItem key={j} value={j}>{j}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!tenantId || applyPreset.isPending}
                    onClick={() => tenantId && applyPreset.mutate({ tenantId, jurisdiction: presetJurisdiction })}
                  >
                    Re-apply preset
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Chart of Accounts card ───────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">Chart of Accounts</CardTitle>
                <CardDescription>
                  Codes that the AI maps invoice lines to. {accounts.length} active.
                </CardDescription>
              </div>
              {accounts.length === 0 && tenantId && (
                <Button
                  size="sm"
                  variant="default"
                  disabled={seedChart.isPending}
                  onClick={() => seedChart.mutate(tenantId)}
                >
                  {seedChart.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Seeding…</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" />Seed default chart (17 accounts)</>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick-add form */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-5 items-end rounded-md border bg-muted/20 p-3">
              <div className="md:col-span-1">
                <Label className="text-xs">Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="4001" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Freight Revenue" />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as GlAccountType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GL_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Tags (csv)</Label>
                  <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="freight,ocean" />
                </div>
                <Button
                  size="sm"
                  onClick={() => void handleCreate()}
                  disabled={createAccount.isPending}
                >
                  {createAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Accounts table */}
            {accountsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading accounts…
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                No accounts yet. Add one above or seed the default chart.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Tags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono">{a.code}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        <TableCell>
                          <Badge variant={GL_TYPE_VARIANT[a.type]} className="text-xs">
                            {a.type.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {a.tags.map((t) => (
                              <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
