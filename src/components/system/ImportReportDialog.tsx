import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle, XCircle, AlertTriangle, Clock, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ImportSession } from '@/lib/import-history-service';
import { format } from 'date-fns';

interface ImportReportDialogProps {
  session: ImportSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportError {
  id: string;
  row_number: number;
  field: string;
  error_message: string;
  raw_data: any;
}

export function ImportReportDialog({ session, open, onOpenChange }: ImportReportDialogProps) {
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorStats, setErrorStats] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open && session?.id) {
      fetchErrors();
    }
  }, [open, session]);

  const fetchErrors = async () => {
    setLoading(true);
    try {
      // Fetch errors
      const { data, error } = await supabase
        .from('import_errors')
        .select('*')
        .eq('import_id', session.id)
        .limit(100); // Limit for now, maybe add pagination later

      if (error) throw error;
      
      setErrors(data || []);

      // Calculate stats (client side for now, or use separate query)
      const stats: Record<string, number> = {};
      data?.forEach(err => {
        stats[err.field] = (stats[err.field] || 0) + 1;
      });
      setErrorStats(stats);

    } catch (e) {
      console.error("Failed to fetch import errors", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadErrors = () => {
    if (!errors.length) return;
    
    const headers = ['Row', 'Field', 'Error Message', 'Raw Data'];
    const csvContent = [
      headers.join(','),
      ...errors.map(e => [
        e.row_number, 
        e.field, 
        `"${e.error_message.replace(/"/g, '""')}"`, 
        `"${JSON.stringify(e.raw_data).replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `import_errors_${session.file_name}_${session.id.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = session.summary || { success: 0, failed: 0, inserted: 0, updated: 0 };
  const total = summary.success + summary.failed;
  const duration = session.imported_at ? 'N/A' : 'N/A'; // TODO: Calculate if completed_at is available

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Report: {session.file_name}</DialogTitle>
          <div className="text-sm text-muted-foreground">
            {format(new Date(session.imported_at), 'PPP p')}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Processed</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">{total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Success</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-green-600">{summary.success}</div>
              <div className="text-xs text-muted-foreground">
                {summary.inserted} inserted, {summary.updated} updated
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Badge variant={session.status === 'success' ? 'default' : session.status === 'failed' ? 'destructive' : 'secondary'}>
                {session.status.toUpperCase()}
              </Badge>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <div className="flex items-center justify-between">
             <div className="font-semibold">Error Breakdown</div>
             {errors.length > 0 && (
               <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                 <Download className="h-4 w-4 mr-2" /> Download Errors
               </Button>
             )}
          </div>
          {Object.keys(errorStats).length > 0 && (
             <div className="flex gap-2 flex-wrap">
               {Object.entries(errorStats).map(([field, count]) => (
                 <Badge key={field} variant="outline" className="text-xs">
                   {field}: {count}
                 </Badge>
               ))}
             </div>
          )}

          <div className="border rounded-md flex-1 overflow-hidden">
             <ScrollArea className="h-[300px]">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead className="w-[80px]">Row</TableHead>
                     <TableHead className="w-[120px]">Field</TableHead>
                     <TableHead>Error Message</TableHead>
                     <TableHead className="w-[200px]">Raw Data</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {loading ? (
                     <TableRow>
                       <TableCell colSpan={4} className="text-center py-4">Loading errors...</TableCell>
                     </TableRow>
                   ) : errors.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                         No errors found.
                       </TableCell>
                     </TableRow>
                   ) : (
                     errors.map((err) => (
                       <TableRow key={err.id}>
                         <TableCell>{err.row_number}</TableCell>
                         <TableCell className="font-medium">{err.field}</TableCell>
                         <TableCell className="text-red-500">{err.error_message}</TableCell>
                         <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-[200px]" title={JSON.stringify(err.raw_data)}>
                           {JSON.stringify(err.raw_data)}
                         </TableCell>
                       </TableRow>
                     ))
                   )}
                 </TableBody>
               </Table>
             </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
