import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuotationWorkspaceState } from '../hooks/useQuotationWorkspaceState';
import type { QuotationPricingIntent } from '../workspace/quotationWorkspaceModel';

const pricingIntentLabels: Record<QuotationPricingIntent, string> = {
  cost_plus: 'Cost Plus',
  market_competitive: 'Market Competitive',
  margin_protect: 'Margin Protect',
};

function ProjectionWidget({ title, contract }: { title: string; contract: string }) {
  return (
    <Card data-projection-widget-contract={contract}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">Rendered as projection-only contract component.</p>
      </CardContent>
    </Card>
  );
}

export function QuotationOwnedWorkspace() {
  const state = useQuotationWorkspaceState();
  return (
    <section className="space-y-4" data-quotation-owned-surface="quote-separation-enhancements">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Quotation 4.9.3 Enhancements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-quotation-owned-surface="quote-composer">
            <div className="space-y-1">
              <Label>Quote</Label>
              <Select value={state.selectedQuoteId} onValueChange={state.setSelectedQuoteId} disabled={state.quotesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quote" />
                </SelectTrigger>
                <SelectContent>
                  {state.quotes.map((quote) => (
                    <SelectItem key={quote.id} value={quote.id}>
                      {quote.quoteNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Pricing Intent State</Label>
              <Select value={state.pricingIntent} onValueChange={(value) => state.setPricingIntent(value as QuotationPricingIntent)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(pricingIntentLabels) as QuotationPricingIntent[]).map((intent) => (
                    <SelectItem key={intent} value={intent}>
                      {pricingIntentLabels[intent]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Composer Write Scope</p>
              <p className="text-sm font-medium">Quote {state.activeQuote?.quoteNumber || 'N/A'}</p>
              <p className="text-xs text-muted-foreground">Status {state.activeQuote?.status || 'draft'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-quotation-owned-surface="plugin-form-blocks">
        <CardHeader className="pb-2">
          <CardTitle>Plugin-driven Domain Form Blocks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.pluginConfig ? (
            state.pluginConfig.sections.map((section) => (
              <div key={section.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{section.title}</p>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {section.fields.filter((field) => !field.hidden).map((field) => (
                    <div key={field.id} className="space-y-1">
                      <Label>{field.label}</Label>
                      <Input
                        value={String(state.pluginFormValues[field.id] ?? '')}
                        onChange={(event) => state.updatePluginField(field.id, event.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No plugin configuration resolved.</p>
          )}
          <div className="flex items-center gap-2">
            <Badge variant={state.pluginValidation.isValid ? 'secondary' : 'destructive'}>
              {state.pluginValidation.isValid ? 'Validation Ready' : 'Validation Blocked'}
            </Badge>
            {!state.pluginValidation.isValid ? (
              <p className="text-xs text-red-600">Missing: {state.pluginValidation.missingRequiredFields.join(', ')}</p>
            ) : null}
          </div>
          <Button onClick={state.saveQuoteDraft}>Save Draft</Button>
          <Badge variant="outline">{state.saveState}</Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card data-quotation-owned-surface="option-comparison">
          <CardHeader className="pb-2">
            <CardTitle>Option Comparison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.options.map((option) => (
              <div key={option.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{option.label}</p>
                  <Badge variant="outline">{option.transitDays} days</Badge>
                </div>
                <p className="text-sm">{option.currency} {option.total.toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-quotation-owned-surface="version-history">
          <CardHeader className="pb-2">
            <CardTitle>Version History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.versions.map((version) => (
              <div
                key={version.id}
                className="rounded-md border p-2"
                data-snapshot-marker={version.snapshotType === 'immutable_snapshot' ? 'immutable' : 'draft'}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{version.versionLabel}</p>
                  <Badge variant={version.snapshotType === 'immutable_snapshot' ? 'secondary' : 'outline'}>
                    {version.snapshotType === 'immutable_snapshot' ? 'Immutable Snapshot' : 'Current Draft'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(version.createdAt).toLocaleString()} · {version.author}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card data-quotation-owned-surface="document-import-export">
        <CardHeader className="pb-2">
          <CardTitle>Document Export and Import Jobs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.asyncJobs.map((job) => (
            <div key={job.id} className="rounded-md border p-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{job.type.toUpperCase()} Job</p>
                <Badge variant="outline">{job.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Progress {job.progress}% · Retries {job.retryCount}</p>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => state.startAsyncJob(job.id)}>
                  Start
                </Button>
                <Button size="sm" variant="secondary" onClick={() => state.tickAsyncJob(job.id)}>
                  Advance
                </Button>
                <Button size="sm" onClick={() => state.retryAsyncJob(job.id)}>
                  Retry
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-quotation-owned-surface="approval-acceptance">
        <CardHeader className="pb-2">
          <CardTitle>Approval and Acceptance Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Policy Status</Label>
              <Select
                value={String(state.policyGateState.policyPassed)}
                onValueChange={(value) => state.updatePolicyGate('policyPassed', value === 'true')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Passed</SelectItem>
                  <SelectItem value="false">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Validation Status</Label>
              <Select
                value={String(state.policyGateState.validationPassed)}
                onValueChange={(value) => state.updatePolicyGate('validationPassed', value === 'true')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Passed</SelectItem>
                  <SelectItem value="false">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Compliance Status</Label>
              <Select
                value={String(state.policyGateState.complianceReady)}
                onValueChange={(value) => state.updatePolicyGate('complianceReady', value === 'true')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ready</SelectItem>
                  <SelectItem value="false">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={state.canAccept ? 'secondary' : 'destructive'}>
              {state.canAccept ? 'Policy Gates Passed' : 'Policy Gates Blocked'}
            </Badge>
            <Button onClick={state.finalizeAcceptance}>Finalize Acceptance</Button>
            <Badge variant="outline">{state.acceptanceState}</Badge>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ProjectionWidget title="Route Projection Panel" contract="quotation.route.projection.v1" />
        <ProjectionWidget title="Compliance Projection Panel" contract="quotation.compliance.projection.v1" />
      </div>
    </section>
  );
}
