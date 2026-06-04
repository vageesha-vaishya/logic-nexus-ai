// AmroDirectiveDetailPage — directive detail with an applicability
// tab that hosts the DirectiveApplicabilityCheck panel (ad-hoc check
// for a single aircraft) PLUS the fleet × this directive matrix
// (all aircraft × this directive verdicts).
//
// Per docs/plans/2026-06-04-directive-applicability-surface-design.md
// slice S5.

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  useDirectiveApplicability,
  type ApplicabilityVerdict,
  type ApplicabilityStatus,
} from '../hooks/useDirectiveApplicabilityVerdicts';
import type {
  DirectiveInput,
  AircraftInput,
} from '../hooks/useDirectiveApplicability';

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

interface AircraftRow {
  id: string;
  registration: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
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
  const aircraft = verdict.aircraft_snapshot_jsonb as {
    registration?: string;
    manufacturer?: string;
    model?: string;
    serial_number?: string;
  };
  return (
    <TableRow>
      <TableCell className="font-mono">
        {aircraft.registration ?? verdict.aircraft_id.slice(0, 8)}
      </TableCell>
      <TableCell className="text-sm">
        {aircraft.manufacturer ?? '—'} {aircraft.model ?? ''}
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

export default function AmroDirectiveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [aircraftRegistration, setAircraftRegistration] = useState('');
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftRow | null>(null);
  const [aircraftLookupError, setAircraftLookupError] = useState<string | null>(null);

  const directiveQuery = useQuery({
    queryKey: ['amro', 'directive', id],
    enabled: !!id,
    queryFn: async (): Promise<DirectiveRow> => {
      if (!id) throw new Error('id required');
      const { data, error } = await supabase
        .from('directives')
        .select('id, directive_no, code_form_no, description, ata_code, applicability, method_of_compliance, effective_date, issuing_authority, kind, relevant_ata_chapters')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Directive not found');
      return data as DirectiveRow;
    },
  });

  const verdictsQuery = useDirectiveApplicability(id, {});

  const directive = directiveQuery.data;
  const verdicts = verdictsQuery.data?.records ?? [];

  const handleLookupAircraft = async () => {
    setAircraftLookupError(null);
    const q = aircraftRegistration.trim().toUpperCase();
    if (!q) return;
    const { data, error } = await supabase
      .from('aircraft')
      .select('id, registration, manufacturer, model, serial_number')
      .eq('registration', q)
      .limit(1)
      .maybeSingle();
    if (error) {
      setAircraftLookupError(error.message);
      return;
    }
    if (!data) {
      setAircraftLookupError(`No aircraft with registration ${q}`);
      setSelectedAircraft(null);
      return;
    }
    setSelectedAircraft(data as AircraftRow);
  };

  const directiveInputForPanel: DirectiveInput | null = directive ? {
    issuing_authority: directive.issuing_authority ?? 'OTHER',
    directive_id: directive.directive_no ?? directive.code_form_no ?? directive.id,
    kind: directive.kind ?? 'OTHER',
    title: directive.description ?? '',
    effective_date: directive.effective_date ?? '',
    applies_to: directive.applicability ?? '',
    compliance_action: directive.method_of_compliance ?? '',
    relevant_ata_chapters: Array.isArray(directive.relevant_ata_chapters)
      ? directive.relevant_ata_chapters
      : (directive.ata_code ? [directive.ata_code] : []),
  } : null;

  const aircraftInputForPanel: AircraftInput | null = selectedAircraft ? {
    manufacturer: selectedAircraft.manufacturer ?? 'Unknown',
    model: selectedAircraft.model ?? 'Unknown',
    serial_number: selectedAircraft.serial_number ?? 'Unknown',
    registration: selectedAircraft.registration ?? undefined,
  } : null;

  if (directiveQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading directive…
        </div>
      </DashboardLayout>
    );
  }
  if (!directive) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <p className="text-sm text-muted-foreground">Directive not found.</p>
          <Button variant="link" asChild>
            <Link to="/dashboard/amro/directives-management">
              <ArrowLeft className="mr-1 h-4 w-4" />Back to directives
            </Link>
          </Button>
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
                <Link to="/dashboard/amro/directives-management">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-bold font-mono">
                {directive.directive_no ?? directive.code_form_no ?? directive.id.slice(0, 8)}
              </h1>
              {directive.issuing_authority && (
                <Badge variant="outline">{directive.issuing_authority}</Badge>
              )}
              {directive.kind && (
                <Badge variant="outline">{directive.kind}</Badge>
              )}
            </div>
            {directive.description && (
              <p className="mt-1 text-sm text-muted-foreground">{directive.description}</p>
            )}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/amro/directives/applicability/queue">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Open review queue
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="info" className="w-full">
          <TabsList>
            <TabsTrigger value="info">Information</TabsTrigger>
            <TabsTrigger value="applicability">
              Applicability ({verdicts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4 space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Regulatory text</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {directive.applicability && (
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                      Applicability
                    </div>
                    <p className="mt-1 whitespace-pre-line">{directive.applicability}</p>
                  </div>
                )}
                {directive.method_of_compliance && (
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                      Method of compliance
                    </div>
                    <p className="mt-1 whitespace-pre-line">{directive.method_of_compliance}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">ATA code</div>
                    <div className="font-mono text-sm">{directive.ata_code ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Effective date</div>
                    <div className="text-sm">{directive.effective_date ?? '—'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applicability" className="mt-4 space-y-4">
            {/* Ad-hoc check panel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Run ad-hoc check</CardTitle>
                <CardDescription>
                  Look up an aircraft by registration to run the LLM applicability check
                  against this directive.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="reg" className="text-xs">Aircraft registration</Label>
                    <Input
                      id="reg"
                      value={aircraftRegistration}
                      onChange={(e) => setAircraftRegistration(e.target.value.toUpperCase())}
                      placeholder="VT-INK"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleLookupAircraft();
                      }}
                    />
                  </div>
                  <Button onClick={() => void handleLookupAircraft()}>Look up</Button>
                </div>
                {aircraftLookupError && (
                  <p className="text-xs text-rose-600">{aircraftLookupError}</p>
                )}
                {selectedAircraft && directiveInputForPanel && aircraftInputForPanel && (
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
                  Every LLM applicability check that's been run against this directive.
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
                          <TableHead>Aircraft</TableHead>
                          <TableHead>Type</TableHead>
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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
