import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ShieldAlert, CheckCircle, AlertTriangle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function SecurityIncidents() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('security_incidents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching incidents:', error);
    } else {
      setIncidents(data || []);
    }
    setLoading(false);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive">Critical</Badge>;
      case 'high': return <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600">High</Badge>;
      case 'medium': return <Badge variant="secondary" className="bg-yellow-500 text-white hover:bg-yellow-600">Medium</Badge>;
      case 'low': return <Badge variant="outline">Low</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge variant="outline" className="border-red-500 text-red-500">Open</Badge>;
      case 'investigating': return <Badge variant="outline" className="border-blue-500 text-blue-500">Investigating</Badge>;
      case 'resolved': return <Badge variant="outline" className="border-green-500 text-green-500">Resolved</Badge>;
      case 'false_positive': return <Badge variant="outline" className="border-gray-500 text-gray-500">False Positive</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredIncidents = incidents.filter(incident => 
    incident.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    incident.incident_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-8 max-w-[1600px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Security Incidents</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage security threats and incidents.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search incidents..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">Loading...</TableCell>
                </TableRow>
              ) : filteredIncidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">No incidents found.</TableCell>
                </TableRow>
              ) : (
                filteredIncidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                    <TableCell className="capitalize">{incident.incident_type.replace('_', ' ')}</TableCell>
                    <TableCell className="max-w-[300px] truncate" title={incident.description}>
                      {incident.description}
                    </TableCell>
                    <TableCell>{getStatusBadge(incident.status)}</TableCell>
                    <TableCell>{format(new Date(incident.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                    <TableCell>
                      {incident.source_details?.email_id && (
                        <span className="text-xs font-mono">Email: {incident.source_details.email_id.substring(0, 8)}...</span>
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
