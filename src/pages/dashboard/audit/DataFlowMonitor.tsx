import { useEffect, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface TransferLog {
    id: string;
    action: string;
    details: {
        status: 'success' | 'failure';
        source?: string;
        itemCount?: number;
        error?: string;
        timestamp?: string;
    };
    created_at: string;
    user_id: string;
}

export function DataFlowMonitor() {
    const { supabase } = useCRM();
    const [logs, setLogs] = useState<TransferLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        success: 0,
        failure: 0,
        successRate: 0
    });

    useEffect(() => {
        fetchLogs();
        
        // Real-time subscription
        const channel = supabase.channel('audit_logs_monitor')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'audit_logs',
                    filter: "resource_type=eq.quote_transfer"
                },
                (payload) => {
                    const newLog = payload.new as TransferLog;
                    setLogs(prev => [newLog, ...prev]);
                    updateStats([newLog, ...logs]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('resource_type', 'quote_transfer')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            
            setLogs(data as TransferLog[]);
            updateStats(data as TransferLog[]);
        } catch (err) {
            console.error('Error fetching transfer logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateStats = (data: TransferLog[]) => {
        const total = data.length;
        const success = data.filter(l => l.details.status === 'success').length;
        const failure = data.filter(l => l.details.status === 'failure').length;
        
        setStats({
            total,
            success,
            failure,
            successRate: total > 0 ? (success / total) * 100 : 100
        });
    };

    if (loading && logs.length === 0) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Transfers</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">Last 50 recorded events</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">{stats.success} successful transfers</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Failures</CardTitle>
                        <XCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">{stats.failure}</div>
                        <p className="text-xs text-muted-foreground">Requires attention</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Data Flow Events</CardTitle>
                    <CardDescription>
                        Real-time log of data synchronization between Quick Quote and Quotation Module.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No transfer events recorded yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="whitespace-nowrap font-mono text-xs">
                                            {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono text-xs">
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={log.details.status === 'success' ? 'default' : 'destructive'}>
                                                {log.details.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {log.details.source || 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-sm max-w-[300px] truncate">
                                            {log.details.error ? (
                                                <span className="text-red-500">{log.details.error}</span>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    {log.details.itemCount ? `${log.details.itemCount} items` : 'No items'} 
                                                    {log.details.itemCount ? ' • ' : ''}
                                                    Transfer complete
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
