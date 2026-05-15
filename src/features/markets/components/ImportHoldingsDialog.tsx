/**
 * ImportHoldingsDialog
 *
 * Full import flow in one dialog:
 *   1. Choose format (Generic / Zerodha / Groww / HDFC / Angel / Upstox)
 *   2. Upload or drag-drop CSV file
 *   3. Preview parsed rows in a table (edit inline not required)
 *   4. Confirm → calls markets-import-holdings edge function
 *   5. Results screen with success/error breakdown
 */

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle, CheckCircle2, ChevronRight, Download,
  Loader2, Upload, X,
} from "lucide-react";

import {
  downloadTemplate,
  parseHoldingsCsv,
  useImportHoldings,
  type ImportFormat,
  type ImportRow,
  type ImportResult,
  type ImportTxnType,
} from "../hooks/useImportHoldings";

import {
  Button, Badge,
  Card, CardContent,
  Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/design-system";
import { cn } from "@/lib/utils";

// ── Format metadata ────────────────────────────────────────────────────────

const FORMATS: { value: ImportFormat; label: string; hint: string; columns: string; note?: string }[] = [
  {
    value: "generic",
    label: "Generic / Our template",
    hint: "Download our template, fill it in, upload here.",
    columns: "symbol, exchange, qty, avg_cost, purchase_date, asset_class, notes, isin, folio_number",
  },
  {
    value: "zerodha",
    label: "Zerodha",
    hint: "Console → Portfolio → Holdings → Download (CSV icon, top-right)",
    columns: "Instrument, ISIN, Qty, Avg. cost, LTP, Cur. val, P&L …",
  },
  {
    value: "groww",
    label: "Groww",
    hint: "App → Portfolio → ⋮ menu → Export Holdings",
    columns: "Name, Symbol, ISIN, Quantity, Average Price, Investment Value …",
  },
  {
    value: "icici_direct",
    label: "ICICI Direct",
    hint: "Website → Stocks → Portfolio → download icon → CSV",
    columns: "NSE Code / Symbol, ISIN, Qty, Avg. Rate, Exchange …",
    note: "Column names vary by account type — the parser auto-detects them.",
  },
  {
    value: "hdfc",
    label: "HDFC Securities",
    hint: "Portal → Portfolio → Holdings → Download",
    columns: "Scrip Name, Market, ISIN, Qty., Avg. Price …",
  },
  {
    value: "angel",
    label: "Angel One",
    hint: "App → Portfolio → Download Holdings CSV",
    columns: "Symbol Name, Token, Buy Qty, Buy Price …",
  },
  {
    value: "upstox",
    label: "Upstox",
    hint: "App → Portfolio → Holdings → Export",
    columns: "symbol, quantity, buy_price, last_price, exchange …",
  },
];

type Step = "setup" | "preview" | "done";

// ── Component ──────────────────────────────────────────────────────────────

export function ImportHoldingsDialog({
  portfolioId,
  portfolioName,
  open,
  onOpenChange,
}: {
  portfolioId: string;
  portfolioName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [step,      setStep]      = useState<Step>("setup");
  const [format,    setFormat]    = useState<ImportFormat>("generic");
  const [txnType,   setTxnType]   = useState<ImportTxnType>("transfer_in");
  const [rows,      setRows]      = useState<ImportRow[]>([]);
  const [parseErr,  setParseErr]  = useState<string | null>(null);
  const [fileName,  setFileName]  = useState<string>("");
  const [result,    setResult]    = useState<ImportResult | null>(null);
  const [dragging,  setDragging]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const importMutation = useImportHoldings(portfolioId);

  // ── Reset on close ───────────────────────────────────────────────────
  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("setup"); setRows([]); setParseErr(null);
      setFileName(""); setResult(null);
    }, 300);
  };

  // ── Parse file ───────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setParseErr("Please upload a CSV or TXT file.");
      return;
    }
    setFileName(file.name);
    setParseErr(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      const parsed = parseHoldingsCsv(csv, format);
      if (parsed.length === 0) {
        setParseErr("No valid rows found. Check the format selected matches your file.");
        return;
      }
      setRows(parsed);
      setStep("preview");
    };
    reader.onerror = () => setParseErr("Could not read the file. Please try again.");
    reader.readAsText(file);
  }, [format]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Import ───────────────────────────────────────────────────────────
  const handleImport = async () => {
    try {
      const res = await importMutation.mutateAsync({ rows, txnType });
      setResult(res);
      setStep("done");
      if (res.imported > 0) {
        toast.success(`${res.imported} holding${res.imported !== 1 ? "s" : ""} imported into "${portfolioName}"`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            Import holdings into "{portfolioName}"
          </DialogTitle>
        </DialogHeader>

        {/* ── Step indicator ──────────────────────────────────────── */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground px-1">
          {(["setup","preview","done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <span className={cn(
                "rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-semibold border",
                step === s ? "border-primary bg-primary text-primary-foreground"
                           : i < (["setup","preview","done"] as Step[]).indexOf(step)
                             ? "border-primary bg-primary/10 text-primary"
                             : "border-muted-foreground/30 text-muted-foreground"
              )}>{i + 1}</span>
              <span className={step === s ? "text-foreground font-medium" : ""}>
                {s === "setup" ? "Format & File" : s === "preview" ? "Preview" : "Done"}
              </span>
              {i < 2 && <ChevronRight className="h-3 w-3 opacity-40" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ────────────── STEP 1: Setup ─────────────────────────── */}
          {step === "setup" && (
            <div className="space-y-5 p-1">

              {/* Format picker */}
              <div className="space-y-2">
                <Label>Broker / Format</Label>
                <Select value={format} onValueChange={(v) => { setFormat(v as ImportFormat); setParseErr(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        <span className="font-medium">{f.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(() => {
                  const f = FORMATS.find(f => f.value === format)!;
                  return (
                    <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-1">
                      <p>{f.hint}</p>
                      <p className="font-mono">{f.columns}</p>
                      {f.note && (
                        <p className="text-amber-700 dark:text-amber-400 font-medium">{f.note}</p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Template download (generic only) */}
              {format === "generic" && (
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Download template CSV
                </Button>
              )}

              {/* Transaction type */}
              <div className="space-y-2">
                <Label>Record as</Label>
                <Select value={txnType} onValueChange={(v) => setTxnType(v as ImportTxnType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer_in">
                      <div>
                        <p className="font-medium">Transfer In</p>
                        <p className="text-xs text-muted-foreground">Existing holdings moved into this portfolio</p>
                      </div>
                    </SelectItem>
                    <SelectItem value="buy">
                      <div>
                        <p className="font-medium">Buy</p>
                        <p className="text-xs text-muted-foreground">Treats each row as a historical purchase</p>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* File drop zone */}
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                  dragging ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                role="button"
                aria-label="Upload CSV file"
              >
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">
                  {fileName ? fileName : "Drop your CSV here, or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">CSV or TXT, max 5 MB</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>

              {parseErr && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {parseErr}
                </div>
              )}
            </div>
          )}

          {/* ────────────── STEP 2: Preview ───────────────────────── */}
          {step === "preview" && (
            <div className="space-y-3 p-1">
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  <span className="font-semibold">{rows.length} row{rows.length !== 1 ? "s" : ""}</span>
                  {" "}parsed from <span className="font-mono text-xs">{fileName}</span>
                </p>
                <Button variant="ghost" size="sm" onClick={() => { setStep("setup"); setRows([]); }}>
                  <X className="mr-1 h-3 w-3" /> Change file
                </Button>
              </div>

              <div className="rounded-md border overflow-auto max-h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Exchange</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Avg Cost</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Class</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 200).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-mono font-medium text-sm">{r.symbol}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.exchange || "auto"}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{r.qty}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {r.avg_cost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.purchase_date || "today"}</TableCell>
                        <TableCell>
                          {r.asset_class && (
                            <Badge variant="secondary" className="text-xs capitalize">{r.asset_class}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length > 200 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-2">
                          … {rows.length - 200} more rows (all will be imported)
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <CardContent className="p-3 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                  <p className="font-semibold">Before you import</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Each row becomes a <strong>{txnType === "buy" ? "Buy" : "Transfer In"}</strong> transaction</li>
                    <li>Holdings and P&L are recalculated automatically</li>
                    <li>Symbols not yet in the instrument catalog are created automatically</li>
                    <li>You can delete individual transactions later from the Transactions tab</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ────────────── STEP 3: Done ──────────────────────────── */}
          {step === "done" && result && (
            <div className="space-y-4 p-1">
              <div className={cn(
                "flex items-center gap-3 rounded-lg p-4",
                result.imported > 0
                  ? "bg-emerald-50 dark:bg-emerald-950/20"
                  : "bg-amber-50 dark:bg-amber-950/20"
              )}>
                {result.imported > 0
                  ? <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                  : <AlertCircle  className="h-6 w-6 text-amber-600 shrink-0" />
                }
                <div>
                  <p className="font-semibold">
                    {result.imported > 0
                      ? `${result.imported} holding${result.imported !== 1 ? "s" : ""} imported successfully`
                      : "Nothing was imported"}
                  </p>
                  {result.skipped > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {result.skipped} row{result.skipped !== 1 ? "s" : ""} skipped
                    </p>
                  )}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">
                    Rows with errors ({result.errors.length})
                  </p>
                  <div className="rounded-md border overflow-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Row</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.errors.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{e.row}</TableCell>
                            <TableCell className="font-mono text-sm">{e.symbol}</TableCell>
                            <TableCell className="text-xs text-destructive">{e.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer actions ───────────────────────────────────────── */}
        <DialogFooter className="pt-2 border-t gap-2">
          {step === "setup" && (
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => { setStep("setup"); setRows([]); }}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importMutation.isPending}>
                {importMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</>
                ) : (
                  `Import ${rows.length} holding${rows.length !== 1 ? "s" : ""}`
                )}
              </Button>
            </>
          )}

          {step === "done" && (
            <>
              {result && result.errors.length > 0 && result.imported < rows.length && (
                <Button variant="outline" onClick={() => {
                  // Re-import only failed rows
                  const failedRowNums = new Set(result.errors.map(e => e.row));
                  const retryRows = rows.filter((_, i) => failedRowNums.has(i + 2));
                  setRows(retryRows);
                  setResult(null);
                  setStep("preview");
                }}>
                  Retry failed rows
                </Button>
              )}
              <Button onClick={handleClose}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
