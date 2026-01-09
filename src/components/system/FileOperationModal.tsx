import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type Mode = "import" | "export";

interface FileOperationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  title: string;
  description?: string;
  supportedTypes?: string[];
  templateUrl?: string;
  onFileParsed?: (rows: any[]) => void;
  onProcess?: (rows: any[]) => Promise<any[]>;
  onComplete?: (rows: any[]) => Promise<void> | void;
}

export function FileOperationModal({
  open,
  onOpenChange,
  mode,
  title,
  description,
  supportedTypes = [".csv", ".xlsx", ".xls"],
  templateUrl,
  onFileParsed,
  onProcess,
  onComplete,
}: FileOperationModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "processing" | "complete">(mode === "import" ? "upload" : "complete");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file: File) => {
    setIsLoading(true);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setData(results.data as any[]);
          setIsLoading(false);
          setStep("preview");
          onFileParsed?.(results.data as any[]);
        },
        error: (err) => {
          setError(`Error parsing CSV: ${err.message}`);
          setIsLoading(false);
        },
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          const workbook = XLSX.read(buffer, { type: "binary" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet);
          setData(rows as any[]);
          setIsLoading(false);
          setStep("preview");
          onFileParsed?.(rows as any[]);
        } catch {
          setError("Error parsing Excel file");
          setIsLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setError("Unsupported file format");
      setIsLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!onProcess) return;
    setStep("processing");
    setIsLoading(true);
    setProgress(10);
    const processed = await onProcess(data);
    setProgress(100);
    setData(processed);
    setIsLoading(false);
    setStep("complete");
  };

  const reset = () => {
    setFile(null);
    setData([]);
    setError(null);
    setStep(mode === "import" ? "upload" : "complete");
    setProgress(0);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) reset();
        onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {mode === "import" && step === "upload" && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 text-center hover:bg-accent/50 transition-colors">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-primary font-semibold hover:underline">Click to upload</span> or drag and drop
                <Input id="file-upload" type="file" className="hidden" accept={supportedTypes.join(",")} onChange={handleFileChange} />
              </Label>
              <p className="text-sm text-muted-foreground mt-2">Supported: {supportedTypes.join(", ")}</p>
              {templateUrl && (
                <div className="mt-4">
                  <Button asChild variant="outline">
                    <a href={templateUrl} target="_blank" rel="noreferrer">
                      Template
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}

          {mode === "import" && (step === "preview" || step === "processing" || step === "complete") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  <span className="font-medium">{file?.name}</span>
                  <span className="text-sm text-muted-foreground">({data.length} records)</span>
                </div>
                {step === "preview" && (
                  <Button variant="outline" size="sm" onClick={reset}>
                    Change File
                  </Button>
                )}
              </div>

              {step === "processing" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {data.length > 0 && Object.keys(data[0]).map((h) => <TableHead key={h}>{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row, i) => (
                      <TableRow key={i}>
                        {Object.keys(data[0]).map((k, j) => (
                          <TableCell key={j}>{typeof row[k] === "object" ? JSON.stringify(row[k]) : String(row[k] ?? "")}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {mode === "import" && step === "preview" && (
            <Button onClick={handleProcess} disabled={isLoading || data.length === 0}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Process
            </Button>
          )}
          {mode === "import" && step === "complete" && (
            <Button
              onClick={async () => {
                if (onComplete) await onComplete(data);
                onOpenChange(false);
                reset();
              }}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
