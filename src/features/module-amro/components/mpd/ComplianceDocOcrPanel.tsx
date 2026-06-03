// ComplianceDocOcrPanel — operator UI for llm-compliance-doc-ocr.
// Multi-modal upload + 15-field structured result rendering. Drop-in
// for compliance evidence upload dialogs on work-order surfaces.

import { useRef, useState } from 'react';
import {
  Sparkles,
  Loader2,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PenSquare,
  CalendarClock,
  Hash,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import {
  useComplianceDocOcr,
  type DocumentContext,
  type ComplianceDocOcrOutput,
  type ComplianceDocType,
} from '../../hooks/useComplianceDocOcr';

interface ComplianceDocOcrPanelProps {
  context: DocumentContext;
  onAttach?: (output: ComplianceDocOcrOutput, file: File) => void;
}

const DOC_TYPE_LABEL: Record<ComplianceDocType, string> = {
  'form_8130-3': 'FAA Form 8130-3',
  easa_form_1: 'EASA Form 1',
  caac_aac_038: 'CAAC AAC-038',
  sacaa_card: 'SACAA Card',
  ad_signoff: 'AD Sign-off',
  sb_completion: 'SB Completion',
  ferry_permit: 'Ferry Permit',
  other_release_cert: 'Other Release Cert',
  unknown: 'Unknown',
};

function confidenceTone(c: number): 'destructive' | 'default' | 'secondary' {
  if (c >= 0.9) return 'default';
  if (c >= 0.7) return 'secondary';
  return 'destructive';
}

export function ComplianceDocOcrPanel({ context, onAttach }: ComplianceDocOcrPanelProps) {
  const { mutateAsync, data, isPending, reset } = useComplianceDocOcr();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const parsed = data?.parsed_output ?? null;

  const handlePick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setSelectedFile(f);
      void mutateAsync({ document_context: context, file: f });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI compliance doc extract
        </CardTitle>
        <CardDescription>
          Upload a Form 8130-3 / EASA Form 1 / SACAA card / AD sign-off.
          {context.work_order_package_number && (
            <>
              {' '}for work package <span className="font-medium">{context.work_order_package_number}</span>
            </>
          )}
          {context.aircraft_registration && (
            <>
              {' '}· aircraft <span className="font-medium">{context.aircraft_registration}</span>
            </>
          )}
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {!parsed && (
          <Button onClick={handlePick} disabled={isPending} size="sm" variant={selectedFile ? 'outline' : 'default'}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {selectedFile ? `Re-upload (${selectedFile.name})` : 'Upload document'}
              </>
            )}
          </Button>
        )}

        {parsed && (
          <div className="space-y-4">
            {/* ── Doc type + confidence header ─────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="text-sm">
                <FileText className="mr-1 h-3.5 w-3.5" />
                {DOC_TYPE_LABEL[parsed.doc_type] ?? parsed.doc_type}
              </Badge>
              {parsed.issuing_authority && (
                <Badge variant="secondary">{parsed.issuing_authority}</Badge>
              )}
              <Badge variant={confidenceTone(parsed.confidence)}>
                {Math.round(parsed.confidence * 100)}% confidence
              </Badge>
            </div>

            {/* ── Identification ───────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Issuing organisation" value={parsed.issuing_organisation} />
              <Field
                label="Approval number"
                value={parsed.approval_number}
                icon={<Hash className="h-3 w-3" />}
              />
              <Field label="Part number" value={parsed.part_number} mono />
              <Field label="Description" value={parsed.part_description} />
              <Field
                label={parsed.serial_or_lot.type === 'none' ? 'Serial / lot' : `${parsed.serial_or_lot.type[0].toUpperCase() + parsed.serial_or_lot.type.slice(1)}`}
                value={parsed.serial_or_lot.value}
                mono
              />
              <Field
                label="Quantity"
                value={
                  parsed.quantity.value != null
                    ? `${parsed.quantity.value}${parsed.quantity.unit ? ` ${parsed.quantity.unit}` : ''}`
                    : null
                }
              />
              {parsed.work_performed_codes.length > 0 && (
                <div className="sm:col-span-2">
                  <div className="text-xs font-medium text-muted-foreground">Work performed</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {parsed.work_performed_codes.map((c) => (
                      <Badge key={c} variant="outline">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {parsed.expires_on && (
                <Field
                  label="Expires"
                  value={parsed.expires_on}
                  icon={<CalendarClock className="h-3 w-3" />}
                />
              )}
            </div>

            <Separator />

            {/* ── Signature ────────────────────────────────────────── */}
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <PenSquare className="h-4 w-4" />
                Authorised signature
                {parsed.authorised_signature.present ? (
                  <Badge variant="default">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Present
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="mr-1 h-3 w-3" />
                    Missing
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                <Field label="Name" value={parsed.authorised_signature.signatory_name} compact />
                <Field label="Role" value={parsed.authorised_signature.signatory_role} compact />
                <Field
                  label="Date"
                  value={parsed.authorised_signature.signature_date}
                  compact
                  icon={<CalendarClock className="h-3 w-3" />}
                />
              </div>
            </div>

            {/* ── Aircraft match ───────────────────────────────────── */}
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="mb-1.5 flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4" />
                Aircraft match
                {parsed.applicable_to_aircraft.matches_context === true && (
                  <Badge variant="default">Matches context</Badge>
                )}
                {parsed.applicable_to_aircraft.matches_context === false && (
                  <Badge variant="destructive">Does not match</Badge>
                )}
                {parsed.applicable_to_aircraft.matches_context === null && (
                  <Badge variant="outline">Cannot verify</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {parsed.applicable_to_aircraft.match_rationale}
                {parsed.applicable_to_aircraft.registration_extracted && (
                  <>
                    {' '}Extracted registration:{' '}
                    <span className="font-mono">{parsed.applicable_to_aircraft.registration_extracted}</span>.
                  </>
                )}
              </p>
            </div>

            {/* ── Warnings ─────────────────────────────────────────── */}
            {parsed.warnings.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-xs text-amber-900 dark:text-amber-200">
                  {parsed.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Excerpts ─────────────────────────────────────────── */}
            {parsed.extracted_text_excerpts.length > 0 && (
              <details className="rounded-md border bg-background p-3 text-xs">
                <summary className="cursor-pointer font-medium">
                  Source excerpts ({parsed.extracted_text_excerpts.length})
                </summary>
                <ul className="ml-5 mt-2 list-disc space-y-0.5 text-muted-foreground">
                  {parsed.extracted_text_excerpts.map((e, i) => (
                    <li key={`${i}-${e}`}>&ldquo;{e}&rdquo;</li>
                  ))}
                </ul>
              </details>
            )}

            <Separator />

            <div className="flex gap-2">
              {onAttach && selectedFile && (
                <Button size="sm" onClick={() => onAttach(parsed, selectedFile)}>
                  Attach to work order
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleReset}>
                Upload another
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
// Tiny field renderer kept colocated; not worth its own file.
// ────────────────────────────────────────────────────────────────────
function Field({
  label,
  value,
  icon,
  mono,
  compact,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
  mono?: boolean;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={[
          compact ? 'text-xs' : 'text-sm',
          mono ? 'font-mono' : '',
          value ? '' : 'italic text-muted-foreground/60',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value || '—'}
      </div>
    </div>
  );
}

export default ComplianceDocOcrPanel;
