import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { Download, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function LeadsImportExport() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
      setImportResult(null);
    } else {
      toast.error('Please select a valid CSV file');
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setImporting(true);
    setProgress(0);
    const result: ImportResult = { success: 0, failed: 0, errors: [] };

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        const total = rows.length;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          
          try {
            // Extract standard fields
            const leadData: any = {
              first_name: row.first_name || row.firstName,
              last_name: row.last_name || row.lastName,
              email: row.email,
              phone: row.phone,
              company: row.company,
              title: row.title,
              status: row.status || 'new',
              source: row.source || 'other',
              estimated_value: row.estimated_value ? parseFloat(row.estimated_value) : null,
              expected_close_date: row.expected_close_date || null,
              description: row.description,
              notes: row.notes,
              tenant_id: context.tenantId,
              franchise_id: context.franchiseId,
            };

            // Extract custom fields (any field not in standard schema)
            const standardFields = ['first_name', 'firstName', 'last_name', 'lastName', 'email', 'phone', 
              'company', 'title', 'status', 'source', 'estimated_value', 'expected_close_date', 
              'description', 'notes', 'tenant_id', 'franchise_id'];
            
            const customFields: Record<string, any> = {};
            Object.keys(row).forEach(key => {
              if (!standardFields.includes(key) && row[key]) {
                customFields[key] = row[key];
              }
            });

            if (Object.keys(customFields).length > 0) {
              leadData.custom_fields = customFields;
            }

            const { error } = await supabase.from('leads').insert(leadData);

            if (error) {
              result.failed++;
              result.errors.push(`Row ${i + 1}: ${error.message}`);
            } else {
              result.success++;
            }
          } catch (err) {
            result.failed++;
            result.errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }

          setProgress(((i + 1) / total) * 100);
        }

        setImportResult(result);
        setImporting(false);
        
        if (result.success > 0) {
          toast.success(`Successfully imported ${result.success} leads`);
        }
        if (result.failed > 0) {
          toast.error(`Failed to import ${result.failed} leads`);
        }
      },
      error: (error) => {
        toast.error(`CSV parsing error: ${error.message}`);
        setImporting(false);
      }
    });
  };

  const handleExport = async () => {
    setExporting(true);
    
    try {
      let query = supabase.from('leads').select('*');

      // Apply filters based on user context
      if (context.franchiseId) {
        query = query.eq('franchise_id', context.franchiseId);
      } else if (context.tenantId) {
        query = query.eq('tenant_id', context.tenantId);
      }

      const { data: leads, error } = await query;

      if (error) throw error;

      if (!leads || leads.length === 0) {
        toast.error('No leads found to export');
        setExporting(false);
        return;
      }

      // Flatten data for CSV export
      const exportData = leads.map(lead => {
        const { custom_fields, ...standardFields } = lead;
        const customFieldsObj = (custom_fields && typeof custom_fields === 'object') ? custom_fields as Record<string, any> : {};
        return {
          ...standardFields,
          ...customFieldsObj
        };
      });

      // Generate CSV
      const csv = Papa.unparse(exportData);
      
      // Download file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${leads.length} leads successfully`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export leads');
    } finally {
      setExporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        company: 'Example Corp',
        title: 'CEO',
        status: 'new',
        source: 'website',
        estimated_value: '50000',
        expected_close_date: '2025-12-31',
        description: 'Potential high-value client',
        notes: 'Met at conference',
        custom_field_1: 'Custom Value 1',
        custom_field_2: 'Custom Value 2'
      }
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'leads_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Template downloaded');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Import / Export Leads</h1>
            <p className="text-muted-foreground mt-1">
              Bulk manage your lead data with CSV files
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard/leads')}>
            Back to Leads
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Import Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                <CardTitle>Import Leads</CardTitle>
              </div>
              <CardDescription>
                Upload a CSV file to import multiple leads at once
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  disabled={importing}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>

              {importing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Importing...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              {importResult && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Import Complete</p>
                      <div className="flex gap-4 text-sm">
                        <Badge variant="default">Success: {importResult.success}</Badge>
                        <Badge variant="destructive">Failed: {importResult.failed}</Badge>
                      </div>
                      {importResult.errors.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm">
                            View errors ({importResult.errors.length})
                          </summary>
                          <ul className="mt-2 space-y-1 text-xs">
                            {importResult.errors.slice(0, 10).map((error, i) => (
                              <li key={i} className="text-destructive">{error}</li>
                            ))}
                            {importResult.errors.length > 10 && (
                              <li>...and {importResult.errors.length - 10} more</li>
                            )}
                          </ul>
                        </details>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleImport}
                  disabled={!selectedFile || importing}
                  className="flex-1"
                >
                  {importing ? 'Importing...' : 'Import Leads'}
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  disabled={importing}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>CSV Format:</strong> Your file should include columns like first_name, 
                  last_name, email, phone, company, title, status, source, etc. 
                  Any additional columns will be stored as custom fields.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Export Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                <CardTitle>Export Leads</CardTitle>
              </div>
              <CardDescription>
                Download all your leads as a CSV file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Export all leads with their standard and custom fields to a CSV file.
                  The export will include all leads you have access to based on your role.
                </p>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">What's included:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• All standard lead fields</li>
                    <li>• Custom fields data</li>
                    <li>• Lead scores and status</li>
                    <li>• Contact information</li>
                    <li>• Activity timestamps</li>
                  </ul>
                </div>

                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full"
                  size="lg"
                >
                  {exporting ? (
                    'Exporting...'
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export All Leads
                    </>
                  )}
                </Button>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    The exported CSV can be edited and re-imported. Make sure to keep 
                    the column headers unchanged for successful re-import.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Custom Fields Info */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Fields Support</CardTitle>
            <CardDescription>
              Flexibly manage additional lead data beyond standard fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-medium">During Import</h4>
                <p className="text-sm text-muted-foreground">
                  Any columns in your CSV that don't match standard fields will automatically 
                  be stored as custom fields for each lead.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">During Export</h4>
                <p className="text-sm text-muted-foreground">
                  All custom fields are included in the export alongside standard fields, 
                  making it easy to maintain your custom data structure.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Data Flexibility</h4>
                <p className="text-sm text-muted-foreground">
                  Store any additional information like industry codes, lead scores, 
                  qualification notes, or any custom metrics your business needs.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
