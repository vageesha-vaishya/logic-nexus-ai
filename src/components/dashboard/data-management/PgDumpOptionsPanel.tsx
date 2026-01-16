import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Settings, SlidersHorizontal, Search, HelpCircle } from "lucide-react";

export type PgDumpCategoryOptions = {
  all: boolean;
  schema: boolean;
  constraints: boolean;
  indexes: boolean;
  dbFunctions: boolean;
  rlsPolicies: boolean;
  enums: boolean;
  edgeFunctions: boolean;
  secrets: boolean;
  tableData: boolean;
};

export type PgDumpGeneralOptions = {
  outputMode: "insert" | "copy";
  includeDropStatements: boolean;
  excludeAuthSchema: boolean;
  excludeStorageSchema: boolean;
  customSchemas: string;
  baseFilename: string;
  dataCompletenessThresholdRatio?: number;
};

type Props = {
  categories: PgDumpCategoryOptions;
  general: PgDumpGeneralOptions;
  onChangeCategories: (next: PgDumpCategoryOptions) => void;
  onChangeGeneral: (next: PgDumpGeneralOptions) => void;
  disabled?: boolean;
};

export function PgDumpOptionsPanel({
  categories,
  general,
  onChangeCategories,
  onChangeGeneral,
  disabled = false,
}: Props) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return () => true;
    return (label: string) => label.toLowerCase().includes(q);
  }, [query]);

  const toggleAll = (on: boolean) => {
    onChangeCategories({
      all: on,
      schema: on,
      constraints: on,
      indexes: on,
      dbFunctions: on,
      rlsPolicies: on,
      enums: on,
      edgeFunctions: on,
      secrets: on,
      tableData: on,
    });
  };

  const setCategory = (key: keyof PgDumpCategoryOptions, on: boolean) => {
    const next = { ...categories, [key]: on };
    next.all = Object.values(next).every(Boolean);
    onChangeCategories(next);
  };

  const setGeneral = <K extends keyof PgDumpGeneralOptions>(key: K, value: PgDumpGeneralOptions[K]) => {
    onChangeGeneral({ ...general, [key]: value });
  };

  const isAllSelected = Object.values(categories).every(Boolean);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">pg_dump Options</CardTitle>
            <Badge variant="outline" className="ml-2">Compatible</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                onChangeCategories({
                  all: true,
                  schema: true,
                  constraints: true,
                  indexes: true,
                  dbFunctions: true,
                  rlsPolicies: true,
                  enums: true,
                  edgeFunctions: true,
                  secrets: true,
                  tableData: true,
                });
                onChangeGeneral({
                  ...general,
                  excludeAuthSchema: false,
                  excludeStorageSchema: false,
                });
              }}
            >
              Full schema including auth/storage
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                onChangeCategories({
                  all: false,
                  schema: true,
                  constraints: true,
                  indexes: true,
                  dbFunctions: true,
                  rlsPolicies: true,
                  enums: true,
                  edgeFunctions: false,
                  secrets: false,
                  tableData: false,
                });
                onChangeGeneral({
                  ...general,
                  excludeAuthSchema: false,
                  excludeStorageSchema: false,
                });
              }}
            >
              Structure-only schema (no data, includes auth/storage)
            </Button>
          </div>
        </div>
        <CardDescription>Configure export/import settings and included components</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter options"
            className="max-w-xs"
          />
        </div>

        <Accordion type="multiple" className="w-full">
          <AccordionItem value="components">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Components
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {matches("ALL") && (
                  <div className="flex items-center justify-between rounded border p-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="all" className="cursor-pointer">ALL</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>Toggle all components on or off</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch id="all" checked={isAllSelected} onCheckedChange={(v) => toggleAll(!!v)} disabled={disabled} />
                  </div>
                )}

                {matches("Schema") && (
                  <div className="flex items-center justify-between rounded border p-3">
                    <Label htmlFor="schema" className="cursor-pointer">Schema (Tables/Columns)</Label>
                    <Switch id="schema" checked={categories.schema} onCheckedChange={(v) => setCategory("schema", !!v)} disabled={disabled} />
                  </div>
                )}
                {matches("Constraints") && (
                  <div className="flex items-center justify-between rounded border p-3">
                    <Label htmlFor="constraints" className="cursor-pointer">Constraints</Label>
                    <Switch id="constraints" checked={categories.constraints} onCheckedChange={(v) => setCategory("constraints", !!v)} disabled={disabled} />
                  </div>
                )}
                {matches("Indexes") && (
                  <div className="flex items-center justify-between rounded border p-3">
                    <Label htmlFor="indexes" className="cursor-pointer">Indexes</Label>
                    <Switch id="indexes" checked={categories.indexes} onCheckedChange={(v) => setCategory("indexes", !!v)} disabled={disabled} />
                  </div>
                )}
                {matches("DB Functions") && (
                  <div className="flex items-center justify-between rounded border p-3">
                    <Label htmlFor="dbFunctions" className="cursor-pointer">DB Functions</Label>
                    <Switch id="dbFunctions" checked={categories.dbFunctions} onCheckedChange={(v) => setCategory("dbFunctions", !!v)} disabled={disabled} />
                  </div>
                )}
                {matches("RLS Policies") && (
                  <div className="flex items-center justify-between rounded border p-3">
                    <Label htmlFor="rlsPolicies" className="cursor-pointer">RLS Policies</Label>
                    <Switch id="rlsPolicies" checked={categories.rlsPolicies} onCheckedChange={(v) => setCategory("rlsPolicies", !!v)} disabled={disabled} />
                  </div>
                )}
                {matches("Enums") && (
                  <div className="flex items-center justify-between rounded border p-3">
                    <Label htmlFor="enums" className="cursor-pointer">Enums</Label>
                    <Switch id="enums" checked={categories.enums} onCheckedChange={(v) => setCategory("enums", !!v)} disabled={disabled} />
                  </div>
                )}
                {matches("Edge Functions") && (
                  <div className="flex items-center justify-between rounded border p-3">
                    <Label htmlFor="edgeFunctions" className="cursor-pointer">Edge Functions</Label>
                    <Switch id="edgeFunctions" checked={categories.edgeFunctions} onCheckedChange={(v) => setCategory("edgeFunctions", !!v)} disabled={disabled} />
                  </div>
                )}
                {matches("Secrets") && (
                  <div className="flex items-center justify-between rounded border p-3">
                    <Label htmlFor="secrets" className="cursor-pointer flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Secrets (Vault)
                    </Label>
                    <Switch id="secrets" checked={categories.secrets} onCheckedChange={(v) => setCategory("secrets", !!v)} disabled={disabled} />
                  </div>
                )}
                {matches("Table Data") && (
                  <div className="flex items-center justify-between rounded border p-3">
                    <Label htmlFor="tableData" className="cursor-pointer">Table Data</Label>
                    <Switch id="tableData" checked={categories.tableData} onCheckedChange={(v) => setCategory("tableData", !!v)} disabled={disabled} />
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="general">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                General
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Output Mode</Label>
                  <Select
                    value={general.outputMode}
                    onValueChange={(v: "insert" | "copy") => setGeneral("outputMode", v)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select output mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insert">INSERT statements</SelectItem>
                      <SelectItem value="copy">COPY statements</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Include DROP Statements</Label>
                  <Switch
                    checked={general.includeDropStatements}
                    onCheckedChange={(v) => setGeneral("includeDropStatements", !!v)}
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Exclude Auth Schema</Label>
                  <Switch
                    checked={general.excludeAuthSchema}
                    onCheckedChange={(v) => setGeneral("excludeAuthSchema", !!v)}
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Exclude Storage Schema</Label>
                  <Switch
                    checked={general.excludeStorageSchema}
                    onCheckedChange={(v) => setGeneral("excludeStorageSchema", !!v)}
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Custom Schemas</Label>
                  <Input
                    value={general.customSchemas}
                    onChange={(e) => {
                      const v = e.target.value;
                      const valid = v.split(",").every(s => s.trim().length === 0 || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s.trim()));
                      if (valid) setGeneral("customSchemas", v);
                    }}
                    placeholder="e.g. public,auth"
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Base Filename</Label>
                  <Input
                    value={general.baseFilename}
                    onChange={(e) => setGeneral("baseFilename", e.target.value)}
                    placeholder="database_export.sql"
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Data Completeness Warning Threshold</Label>
                  <Input
                    type="number"
                    min={1}
                    step={0.1}
                    value={general.dataCompletenessThresholdRatio ?? 1.1}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isNaN(v) || v < 1) {
                        setGeneral("dataCompletenessThresholdRatio", undefined);
                      } else {
                        setGeneral("dataCompletenessThresholdRatio", v);
                      }
                    }}
                    disabled={disabled}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
