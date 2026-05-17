/**
 * AMRO Enterprise Tooling Editor - WORKING VERSION
 * Direct Supabase integration
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { logger } from "@/lib/logger";

interface ToolingRegistry {
  id: string;
  tool_code: string;
  tool_name: string;
  manufacturer: string;
  tool_category: string;
  calibration_required: boolean;
}

interface ToolingLineItem {
  id: string;
  tool_id: string;
  tool_code: string;
  tool_name: string;
  manufacturer: string;
  tool_category: string;
  quantity_required: number;
  calibration_required: boolean;
}

interface EnterpriseToolingEditorProps {
  tools: ToolingLineItem[];
  onChange: (tools: ToolingLineItem[]) => void;
  readOnly?: boolean;
}

export function EnterpriseToolingEditor({
  tools,
  onChange,
  readOnly = false,
}: EnterpriseToolingEditorProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ToolingRegistry[]>([]);
  const [searching, setSearching] = useState(false);

  const totalTools = tools.length;
  const calibrationRequired = tools.filter((t) => t.calibration_required).length;

  // Search tools
  const searchTools = useCallback(async (query: string) => {
    setSearching(true);
    try {
      logger.debug('[TOOLING SEARCH] Starting search...');
      
      // First check if we can query the table at all
      const { data: countData, error: countError } = await supabase
        .from('amro_tooling_registry')
        .select('*', { count: 'exact', head: true });
      
      logger.debug('[TOOLING SEARCH] Table check:', { count: countData?.length, error: countError });

      let q = supabase
        .from('amro_tooling_registry')
        .select('*')
        .limit(50);

      if (query) {
        q = q.or(`tool_code.ilike.%${query}%,tool_name.ilike.%${query}%,manufacturer.ilike.%${query}%`);
      }

      const { data, error } = await q;

      logger.debug('[TOOLING SEARCH] Query result:', { 
        rowCount: data?.length || 0, 
        error: error?.message || null,
        firstRow: data?.[0] || null
      });

      if (error) {
        logger.error('[TOOLING SEARCH] Error:', error);
        setSearchResults([]);
        toast.error(`Failed to search tools: ${error.message}`);
      } else {
        setSearchResults(data || []);
        if ((data?.length || 0) === 0) {
          toast.info('No tools found in registry');
        }
      }
    } catch (error: any) {
      logger.error('[TOOLING SEARCH] Exception:', error);
      setSearchResults([]);
      toast.error(`Search exception: ${error.message}`);
    } finally {
      setSearching(false);
    }
  }, []);

  // Add tool
  const addTool = useCallback((tool: ToolingRegistry) => {
    const exists = tools.find((t) => t.tool_id === tool.id);
    if (exists) {
      logger.debug('Tool already exists:', tool.tool_code);
      return;
    }

    const newTool: ToolingLineItem = {
      id: crypto.randomUUID(),
      tool_id: tool.id,
      tool_code: tool.tool_code,
      tool_name: tool.tool_name,
      manufacturer: tool.manufacturer,
      tool_category: tool.tool_category,
      quantity_required: 1,
      calibration_required: tool.calibration_required,
    };

    const updatedTools = [...tools, newTool];
    logger.debug('=== TOOLING ADD ===');
    logger.debug('Adding tool:', tool.tool_code);
    logger.debug('Updated tools array:', updatedTools);
    logger.debug('Calling onChange with:', updatedTools);
    onChange(updatedTools);
    logger.debug('onChange called successfully');
    logger.debug('====================');
  }, [tools, onChange]);

  // Update tool
  const updateTool = useCallback((id: string, updates: Partial<ToolingLineItem>) => {
    onChange(tools.map((tool) => tool.id === id ? { ...tool, ...updates } : tool));
  }, [tools, onChange]);

  // Remove tool
  const removeTool = useCallback((id: string) => {
    onChange(tools.filter((tool) => tool.id !== id));
  }, [tools, onChange]);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      hand_tool: 'bg-gray-100 text-gray-800',
      power_tool: 'bg-blue-100 text-blue-800',
      test_equipment: 'bg-purple-100 text-purple-800',
      ground_support: 'bg-orange-100 text-orange-800',
      special_tool: 'bg-red-100 text-red-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Enterprise Tooling</h3>
          <p className="text-sm text-muted-foreground">
            {totalTools} tools • {calibrationRequired} require calibration
          </p>
        </div>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={() => { setSearchOpen(true); searchTools(''); }}>
            <Search className="h-4 w-4 mr-2" />
            Add from Registry
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Tools</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalTools}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Calibration Required</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{calibrationRequired}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Quantity</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{tools.reduce((s, t) => s + t.quantity_required, 0)}</div></CardContent>
        </Card>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool Code</TableHead>
              <TableHead>Tool Name</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Calibration</TableHead>
              {!readOnly && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tools.map((tool) => (
              <TableRow key={tool.id}>
                <TableCell className="font-mono">{tool.tool_code}</TableCell>
                <TableCell>{tool.tool_name}</TableCell>
                <TableCell>{tool.manufacturer}</TableCell>
                <TableCell><Badge className={getCategoryColor(tool.tool_category)}>{tool.tool_category.replace(/_/g, ' ')}</Badge></TableCell>
                <TableCell>
                  <Input type="number" value={tool.quantity_required} onChange={(e) => updateTool(tool.id, { quantity_required: Number(e.target.value) })} disabled={readOnly} className="h-8 w-20" min={1} />
                </TableCell>
                <TableCell>
                  {tool.calibration_required ? (
                    <Badge variant="outline" className="text-yellow-700">Required</Badge>
                  ) : (
                    <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Not Required</Badge>
                  )}
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => removeTool(tool.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {tools.length === 0 && (
              <TableRow><TableCell colSpan={readOnly ? 6 : 7} className="text-center py-8 text-muted-foreground">No tools added. Click "Add from Registry" to search.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Search Tooling Registry</DialogTitle></DialogHeader>
          <Input placeholder="Search tools..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); searchTools(e.target.value); }} />
          {searching && <div className="text-center py-4">Searching...</div>}
          {!searching && searchResults.length > 0 && (
            <div className="border rounded-lg max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Calibration</TableHead><TableHead>Action</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((tool) => (
                    <TableRow key={tool.id}>
                      <TableCell className="font-mono">{tool.tool_code}</TableCell>
                      <TableCell>{tool.tool_name}</TableCell>
                      <TableCell><Badge className={getCategoryColor(tool.tool_category)}>{tool.tool_category.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell>{tool.calibration_required ? 'Required' : 'Not Required'}</TableCell>
                      <TableCell><Button size="sm" onClick={() => addTool(tool)}><Plus className="h-4 w-4 mr-1" />Add</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
