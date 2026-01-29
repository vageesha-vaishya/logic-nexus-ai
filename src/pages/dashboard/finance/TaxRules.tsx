
import { useEffect, useState } from 'react';
import { Plus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TaxManagementService } from '@/services/taxation/TaxManagementService';
import { TaxRule, TaxJurisdiction } from '@/services/taxation/types';
import { TaxRuleDialog } from './TaxRuleDialog';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function TaxRules() {
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [jurisdictions, setJurisdictions] = useState<TaxJurisdiction[]>([]);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<TaxRule | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    loadJurisdictions();
    loadRules();
  }, []);

  useEffect(() => {
    loadRules();
  }, [selectedJurisdiction]);

  const loadJurisdictions = async () => {
    try {
      const data = await TaxManagementService.getJurisdictions();
      setJurisdictions(data);
    } catch (error) {
      console.error('Error loading jurisdictions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load jurisdictions',
        variant: 'destructive',
      });
    }
  };

  const loadRules = async () => {
    setIsLoading(true);
    try {
      const jurisdictionId = selectedJurisdiction === 'all' ? undefined : selectedJurisdiction;
      const data = await TaxManagementService.getTaxRules(jurisdictionId);
      setRules(data);
    } catch (error) {
      console.error('Error loading tax rules:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tax rules',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRule = () => {
    if (selectedJurisdiction === 'all') {
      toast({
        title: "Select Jurisdiction",
        description: "Please select a specific jurisdiction to add a rule.",
        variant: "destructive"
      });
      return;
    }
    setSelectedRule(undefined);
    setIsDialogOpen(true);
  };

  const handleEditRule = (rule: TaxRule) => {
    setSelectedRule(rule);
    setIsDialogOpen(true);
  };

  const handleRuleSaved = () => {
    setIsDialogOpen(false);
    loadRules();
    toast({
      title: 'Success',
      description: 'Tax rule saved successfully',
    });
  };

  const getJurisdictionName = (id: string) => {
    return jurisdictions.find(j => j.id === id)?.name || id;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tax Rules</h2>
          <p className="text-muted-foreground">
            Manage tax rates and rules for different jurisdictions
          </p>
        </div>
        <Button onClick={handleAddRule} disabled={selectedJurisdiction === 'all'}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Rules List</CardTitle>
              <CardDescription>
                Viewing {rules.length} tax rules
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedJurisdiction}
                onValueChange={setSelectedJurisdiction}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by Jurisdiction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jurisdictions</SelectItem>
                  {jurisdictions.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.name} ({j.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading rules...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Tax Code</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No tax rules found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">
                        {getJurisdictionName(rule.jurisdictionId)}
                      </TableCell>
                      <TableCell>
                        {rule.taxCodeId || <span className="text-muted-foreground">Standard</span>}
                      </TableCell>
                      <TableCell>
                        {(rule.rate * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          rule.ruleType === 'STANDARD' ? 'bg-blue-100 text-blue-800' :
                          rule.ruleType === 'REDUCED' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {rule.ruleType}
                        </span>
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        {format(new Date(rule.effectiveFrom), 'PP')}
                      </TableCell>
                      <TableCell>
                        {rule.effectiveTo ? format(new Date(rule.effectiveTo), 'PP') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRule(rule)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TaxRuleDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        jurisdictionId={selectedRule?.jurisdictionId || selectedJurisdiction}
        ruleToEdit={selectedRule}
        onSuccess={handleRuleSaved}
      />
    </div>
  );
}
