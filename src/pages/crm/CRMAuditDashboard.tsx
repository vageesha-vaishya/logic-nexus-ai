// File: src/pages/crm/CRMAuditDashboard.tsx

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { CRMAuditTable } from '@/components/crm/audit/CRMAuditTable';
import { CRMAuditStatistics } from '@/components/crm/audit/CRMAuditStatistics';
import { CRMAuditExport } from '@/components/crm/audit/CRMAuditExport';
import { useCRMAuditTrail } from '@/hooks/useCRMAuditTrail';
import { useAuth } from '@/hooks/useAuth';
import { History, RefreshCw } from 'lucide-react';

const ENTITY_TYPES = ['lead', 'contact', 'opportunity', 'quote', 'interaction'];
const ACTIONS = ['create', 'update', 'delete', 'move', 'approve', 'reject'];

export function CRMAuditDashboard() {
  const { user } = useAuth();
  const [entityType, setEntityType] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [userId, setUserId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isLive, setIsLive] = useState(false);

  const { data, loading, refetch } = useCRMAuditTrail({
    limit: 500
  });

  // Filter data client-side
  const filteredData = data.filter((entry) => {
    if (entityType && entry.entity_type !== entityType) return false;
    if (action && entry.action !== action) return false;
    if (userId && entry.user_id !== userId) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        entry.entity_id.toLowerCase().includes(query) ||
        entry.user_email.toLowerCase().includes(query) ||
        entry.user_name?.toLowerCase().includes(query)
      );
    }
    if (dateFrom) {
      const entryDate = new Date(entry.created_at);
      if (entryDate < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const entryDate = new Date(entry.created_at);
      if (entryDate > new Date(dateTo)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-6 w-6" />
          <h1 className="text-3xl font-bold">CRM Audit Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant={isLive ? 'default' : 'outline'}
            onClick={() => setIsLive(!isLive)}
          >
            {isLive ? 'Live' : 'Paused'}
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Entity Type</label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Action</label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All actions</SelectItem>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Date From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Date To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Search</label>
            <Input
              placeholder="Search by entity ID, email, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <CRMAuditStatistics data={filteredData} />

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Audit Events ({filteredData.length} of {data.length})
          </CardTitle>
          <CRMAuditExport data={filteredData} />
        </CardHeader>
        <CardContent>
          <CRMAuditTable data={filteredData} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}

export default CRMAuditDashboard;
