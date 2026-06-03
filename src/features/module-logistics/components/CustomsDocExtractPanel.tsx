// CustomsDocExtractPanel — operator UI for llm-customs-doc-extract.
// Multi-modal upload + 13 field-group structured result. Drop-in for
// logistics shipment-document evidence dialogs. Layout sections the
// output (header, parties, route, totals, line_items) since the
// document carries 40+ fields.

import { useRef, useState } from 'react';
import {
  Sparkles,
  Loader2,
  Upload,
  FileText,
  AlertTriangle,
  Ship,
  Plane,
  Users,
  Package,
  ShieldCheck,
  ArrowRight,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  useCustomsDocExtract,
  type ShipmentContext,
  type CustomsDocExtractOutput,
  type CustomsDocType,
  type CustomsParty,
  type CustomsMoney,
} from '../hooks/useCustomsDocExtract';

interface CustomsDocExtractPanelProps {
  context: ShipmentContext;
  onAttach?: (output: CustomsDocExtractOutput, file: File) => void;
}

const DOC_TYPE_LABEL: Record<CustomsDocType, string> = {
  bill_of_lading: 'Bill of Lading',
  air_waybill: 'Air Waybill',
  commercial_invoice: 'Commercial Invoice',
  packing_list: 'Packing List',
  certificate_of_origin: 'Certificate of Origin',
  customs_declaration: 'Customs Declaration',
  phytosanitary_certificate: 'Phytosanitary Certificate',
  insurance_certificate: 'Insurance Certificate',
  other_freight_doc: 'Other Freight Doc',
  unknown: 'Unknown',
};

const OCEAN_TYPES: CustomsDocType[] = ['bill_of_lading'];
const AIR_TYPES: CustomsDocType[] = ['air_waybill'];

function confidenceTone(c: number): 'destructive' | 'default' | 'secondary' {
  if (c >= 0.9) return 'default';
  if (c >= 0.7) return 'secondary';
  return 'destructive';
}

function fmtMoney(m: CustomsMoney): string {
  if (m.amount == null) return '—';
  const formatted = m.amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return m.currency ? `${m.currency} ${formatted}` : formatted;
}

export function CustomsDocExtractPanel({ context, onAttach }: CustomsDocExtractPanelProps) {
  const { mutateAsync, data, isPending, reset } = useCustomsDocExtract();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const parsed = data?.parsed_output ?? null;

  const handlePick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setSelectedFile(f);
      void mutateAsync({ shipment_context: context, file: f });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const DocIcon = parsed
    ? AIR_TYPES.includes(parsed.doc_type)
      ? Plane
      : OCEAN_TYPES.includes(parsed.doc_type)
        ? Ship
        : FileText
    : FileText;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI customs doc extract
        </CardTitle>
        <CardDescription>
          Upload a Bill of Lading / Commercial Invoice / Certificate of Origin / Packing List.
          {context.booking_reference && (
            <>
              {' '}for booking <span className="font-medium">{context.booking_reference}</span>
            </>
          )}
          {context.origin_country && context.destination_country && (
            <>
              {' '}· <span className="font-medium">{context.origin_country} → {context.destination_country}</span>
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
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="text-sm">
                <DocIcon className="mr-1 h-3.5 w-3.5" />
                {DOC_TYPE_LABEL[parsed.doc_type] ?? parsed.doc_type}
              </Badge>
              {parsed.doc_number && (
                <Badge variant="secondary" className="font-mono">
                  {parsed.doc_number}
                </Badge>
              )}
              {parsed.incoterm && <Badge variant="outline">{parsed.incoterm}</Badge>}
              {parsed.currency && <Badge variant="outline">{parsed.currency}</Badge>}
              <Badge variant={confidenceTone(parsed.confidence)}>
                {Math.round(parsed.confidence * 100)}% confidence
              </Badge>
            </div>

            {/* ── Match-vs-context callout ───────────────────────────── */}
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4" />
                Matches shipment context
                {parsed.matches_shipment_context.booking_ref_match === true && (
                  <Badge variant="default">Booking ref ✓</Badge>
                )}
                {parsed.matches_shipment_context.booking_ref_match === false && (
                  <Badge variant="destructive">Booking ref ✗</Badge>
                )}
                {parsed.matches_shipment_context.country_pair_match === true && (
                  <Badge variant="default">Country pair ✓</Badge>
                )}
                {parsed.matches_shipment_context.country_pair_match === false && (
                  <Badge variant="destructive">Country pair ✗</Badge>
                )}
                {parsed.matches_shipment_context.incoterm_match === true && (
                  <Badge variant="default">Incoterm ✓</Badge>
                )}
                {parsed.matches_shipment_context.incoterm_match === false && (
                  <Badge variant="destructive">Incoterm ✗</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {parsed.matches_shipment_context.match_rationale}
              </p>
            </div>

            {/* ── Parties ────────────────────────────────────────────── */}
            <div>
              <SectionHeader icon={<Users className="h-4 w-4" />} title="Parties" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <PartyCard label="Shipper" party={parsed.parties.shipper} />
                <PartyCard label="Consignee" party={parsed.parties.consignee} />
                <PartyCard label="Notify party" party={parsed.parties.notify_party} />
              </div>
            </div>

            {/* ── Route ──────────────────────────────────────────────── */}
            <div>
              <SectionHeader icon={<ArrowRight className="h-4 w-4" />} title="Route" />
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <Field label="Port of loading" value={parsed.route.port_of_loading} />
                <Field label="Port of discharge" value={parsed.route.port_of_discharge} />
                <Field label="Place of receipt" value={parsed.route.place_of_receipt} />
                <Field label="Place of delivery" value={parsed.route.place_of_delivery} />
                <Field label="Vessel / flight" value={parsed.route.vessel_or_flight} />
                <Field label="Departure" value={parsed.route.departure_date} />
                <Field label="ETA" value={parsed.route.estimated_arrival_date} />
              </div>
            </div>

            {/* ── Totals ─────────────────────────────────────────────── */}
            <div>
              <SectionHeader icon={<Package className="h-4 w-4" />} title="Totals" />
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <Field label="Invoice value" value={fmtMoney(parsed.totals.invoice_value)} />
                <Field label="Freight" value={fmtMoney(parsed.totals.freight)} />
                <Field label="Insurance" value={fmtMoney(parsed.totals.insurance)} />
                <Field
                  label="Packages"
                  value={
                    parsed.totals.total_packages.value != null
                      ? `${parsed.totals.total_packages.value} ${parsed.totals.total_packages.unit ?? ''}`.trim()
                      : null
                  }
                />
                <Field
                  label="Gross weight"
                  value={
                    parsed.totals.gross_weight.value != null
                      ? `${parsed.totals.gross_weight.value} ${parsed.totals.gross_weight.unit ?? ''}`.trim()
                      : null
                  }
                />
                <Field
                  label="Net weight"
                  value={
                    parsed.totals.net_weight.value != null
                      ? `${parsed.totals.net_weight.value} ${parsed.totals.net_weight.unit ?? ''}`.trim()
                      : null
                  }
                />
                <Field
                  label="Volume"
                  value={
                    parsed.totals.volume.value != null
                      ? `${parsed.totals.volume.value} ${parsed.totals.volume.unit ?? ''}`.trim()
                      : null
                  }
                />
              </div>
            </div>

            {/* ── Line items ─────────────────────────────────────────── */}
            {parsed.line_items.length > 0 && (
              <div>
                <SectionHeader
                  icon={<FileText className="h-4 w-4" />}
                  title={`Line items (${parsed.line_items.length})`}
                />
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-24">HS code</TableHead>
                        <TableHead className="w-24 text-right">Qty</TableHead>
                        <TableHead className="w-28 text-right">Unit price</TableHead>
                        <TableHead className="w-28 text-right">Total</TableHead>
                        <TableHead className="w-20">Origin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.line_items.map((li, i) => (
                        <TableRow key={`${i}-${li.description}`}>
                          <TableCell className="text-xs">{li.line_no ?? i + 1}</TableCell>
                          <TableCell className="text-xs">{li.description}</TableCell>
                          <TableCell className="font-mono text-xs">{li.hs_code ?? '—'}</TableCell>
                          <TableCell className="text-right text-xs">
                            {li.quantity.value} {li.quantity.unit}
                          </TableCell>
                          <TableCell className="text-right text-xs">{fmtMoney(li.unit_price)}</TableCell>
                          <TableCell className="text-right text-xs">{fmtMoney(li.total_price)}</TableCell>
                          <TableCell className="text-xs">{li.country_of_origin ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* ── Warnings ───────────────────────────────────────────── */}
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

            {/* ── Excerpts (collapsible) ─────────────────────────────── */}
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
                  Attach to shipment
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
// Local building blocks — colocated; not worth their own files.
// ────────────────────────────────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
      {icon}
      {title}
    </div>
  );
}

function PartyCard({ label, party }: { label: string; party: CustomsParty }) {
  return (
    <div className="rounded-md border bg-background p-2.5 text-xs">
      <div className="mb-1 font-medium text-muted-foreground">{label}</div>
      <div className="font-medium">{party.name ?? '—'}</div>
      {party.address && <div className="text-muted-foreground">{party.address}</div>}
      <div className="mt-1 flex flex-wrap gap-1">
        {party.country && <Badge variant="outline">{party.country}</Badge>}
        {party.tax_id && (
          <Badge variant="outline" className="font-mono">
            {party.tax_id}
          </Badge>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={value ? 'text-sm' : 'text-sm italic text-muted-foreground/60'}>
        {value || '—'}
      </div>
    </div>
  );
}

export default CustomsDocExtractPanel;
