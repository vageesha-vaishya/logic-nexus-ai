// AmroAircraftApplicabilityPage — aircraft × directives applicability
// matrix. Per docs/plans/2026-06-04-directive-applicability-surface-design.md
// slice S6. Mirrors AmroDirectiveDetailPage but flipped: one aircraft
// vs. many directives.
//
// Naming note: this is NOT a full aircraft detail page (the platform
// already has aircraft master-data lives under amro settings). This
// page is scoped to ONE concern — the directives × this aircraft
// applicability matrix.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { supabase } from '@/integrations/supabase/client';
import { DirectiveApplicabilityCheck } from '@/features/module-amro/components/mpd/DirectiveApplicabilityCheck';
import {
  useAircraftApplicability,
  type ApplicabilityVerdict,
  type ApplicabilityStatus,
} from '../hooks/useDirectiveApplicabilityVerdicts';
import type {
  DirectiveInput,
  AircraftInput,
} from '../hooks/useDirectiveApplicability';

interface AircraftRow {
  id: string;
  registration: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
}

interface DirectiveRow {
  id: string;
  directive_no: string | null;
  code_form_no: string | null;
  description: string | null;
  ata_code: string | null;
  applicability: string | null;
  method_of_compliance: string | null;
  effective_date: string | null;
  issuing_authority?: string | null;
  kind?: string | null;
  relevant_ata_chapters?: string[] | null;
}

function confidenceTone(c: number): 'destructive' | 'default' | 'secondary' {
  if (c >= 0.85) return 'default';
  if (c >= 0.65) return 'secondary';
  return 'destructive';
}

const STATUS_LABEL: Record<ApplicabilityStatus, string> = {
  awaiting_review: 'Awaiting review',
  accepted: 'Accepted',
  overridden: 'Overridden',
  superseded: 'Superseded',
  obsolete: 'Obsolete',
};

const STATUS_VARIANT: Record<ApplicabilityStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  awaiting_review: 'destructive',
  accepted: 'default',
  overridden: 'outline',
  superseded: 'secondary',
  obsolete: 'secondary',
};

function VerdictRow({ verdict }: { verdict: ApplicabilityVerdict }) {
  // Flipped: snapshot the DIRECTIVE here instead of the aircraft.
  const directive = verdict.directive_snapshot_jsonb as {
    directive_no?: string;
    code_form_no?: string;
    description?: string;
    issuing_authority?: string;
    kind?: string;
  };
  const directiveLabel = directive.directive_no
    || directive.code_form_no
    || verdict.directive_id.slice(0, 8);

  return (
    <TableRow>
      <TableCell className="font-mono">
        <Link
          to={`/dashboard/amro/directives/${verdict.directive_id}`}
          className="text-primary hover:underline"
        >
          {directiveLabel}
        </Link>
      </TableCell>
      <TableCell className="max-w-md truncate text-sm">
        {directive.description ?? '—'}
      </TableCell>
      <TableCell>
        {directive.issuing_authority && (
          <Badge variant="outline" className="text-xs">{directive.issuing_authority}</Badge>
        )}
        {directive.kind && (
          <Badge variant="outline" className="ml-1 text-xs">{directive.kind}</Badge>
        )}
      </TableCell>
      <TableCell>
        {verdict.applies ? (
          <Badge variant="default" className="text-xs">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Applies
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            <XCircle className="mr-1 h-3 w-3" />
            Does not apply
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={confidenceTone(verdict.confidence)} className="text-xs">
          {Math.round(verdict.confidence * 100)}%
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[verdict.status]} className="text-xs">
          {STATUS_LABEL[verdict.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        <Clock className="mr-1 inline h-3 w-3" />
        {new Date(verdict.created_at).toLocaleDateString()}
      </TableCell>
    </TableRow>
  );
}

export default function AmroAircraftApplicabilityPage() {
  const { id } = useParams<{ id: string }>();
  const [directiveNo, setDirectiveNo] = useState('');
  const [selectedDirective, setSelectedDirective] = useState<DirectiveRow | null>(null);
  const [directiveLookupError, setDirectiveLookupError] = useState<string | null>(null);

  const aircraftQuery = useQuery({
    queryKey: ['amro', 'aircraft', id],
    enabled: !!id,
    queryFn: async (): Promise<AircraftRow> => {
      if (!id) throw new Error('id required');
      const { data, error } = await supabase
        .from('aircraft')
        .select('id, registration, manufacturer, model, serial_number')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Aircraft not found');
      return data as AircraftRow;
    },
  });

  const verdictsQuery = useAircraftApplicability(id, {});

  const aircraft = aircraftQuery.data;
  const verdicts = verdictsQuery.data?.records ?? [];

  const handleLookupDirective = async () => {
    setDirectiveLookupError(null);
    const q = directiveNo.trim();
    if (!q) return;
    const { data, error } = await supabase
      .from('directives')
      .select('id, directive_no, code_form_no, description, ata_code, applicability, method_of_compliance, effective_date, issuing_authority, kind, relevant_ata_chapters')
      .or(`directive_no.eq.${q},code_form_no.eq.${q}`)
      .limit(1)
      .maybeSingle();
    if (error) {
      setDirectiveLookupError(error.message);
      return;
    }
    if (!data) {
      setDirectiveLookupError(`No directive with number ${q}`);
      setSelectedDirective(null);
      return;
    }
    setSelectedDirective(data as DirectiveRow);
  };

  const directiveInputForPanel: DirectiveInput | null = selectedDirective ? {
    issuing_authority: selectedDirective.issuing_authority ?? 'OTHER',
    directive_id: selectedDirective.directive_no
      ?? selectedDirective.code_form_no
      ?? selectedDirective.id,
    kind: selectedDirective.kind ?? 'OTHER',
    title: selectedDirective.description ?? '',
    effective_date: selectedDirective.effective_date ?? '',
    applies_to: selectedDirective.applicability ?? '',
    compliance_action: selectedDirective.method_of_compliance ?? '',
    relevant_ata_chapters: Array.isArray(selectedDirective.relevant_ata_chapters)
      ? selectedDirective.relevant_ata_chapters
      : (selectedDirective.ata_code ? [selectedDirective.ata_code] : []),
  } : null;

  const aircraftInputForPanel: AircraftInput | null = aircraft ? {
    manufacturer: aircraft.manufacturer ?? 'Unknown',
    model: aircraft.model ?? 'Unknown',
    serial_number: aircraft.serial_number ?? 'Unknown',
    registration: aircraft.registration ?? undefined,
  } : null;

  if (aircraftQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading aircraft…
        </div>
      </DashboardLayout>
    );
  }
  if (!aircraft) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <p className="text-sm text-muted-foreground">Aircraft not found.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/amro">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-bold font-mono">
                {aircraft.registration ?? aircraft.serial_number ?? aircraft.id.slice(0, 8)}
              </h1>
              <span className="text-sm text-muted-foreground">
                {aircraft.manufacturer} {aircraft.model}
                {aircraft.serial_number && <> · S/N {aircraft.serial_number}</>}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Directive applicability matrix
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/amro/directives/applicability/queue">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Open review queue
            </Link>
          </Button>
        </div>

        {/* Ad-hoc check */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Run ad-hoc check</CardTitle>
            <CardDescription>
              Look up a directive by number to run the LLM applicability check against this aircraft.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="directive-no" className="text-xs">Directive number</Label>
                <Input
                  id="directive-no"
                  value={directiveNo}
                  onChange={(e) => setDirectiveNo(e.target.value)}
                  placeholder="AD-2025-12-05 or SB-A320-25-01"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleLookupDirective();
                  }}
                />
              </div>
              <Button onClick={() => void handleLookupDirective()}>Look up</Button>
            </div>
            {directiveLookupError && (
              <p className="text-xs text-rose-600">{directiveLookupError}</p>
            )}
            {selectedDirective && directiveInputForPanel && aircraftInputForPanel && (
              <>
                <Separator />
                <DirectiveApplicabilityCheck
                  directive={directiveInputForPanel}
                  aircraft={aircraftInputForPanel}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Verdicts matrix */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All verdicts ({verdicts.length})</CardTitle>
            <CardDescription>
              Every LLM applicability check against this aircraft.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {verdictsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading verdicts…
              </div>
            ) : verdicts.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                No checks run yet. Use the form above for an ad-hoc check.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Directive</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Verdict</TableHead>
                      <TableHead>Conf.</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Checked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {verdicts.map((v) => (
                      <VerdictRow key={v.id} verdict={v} />
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
