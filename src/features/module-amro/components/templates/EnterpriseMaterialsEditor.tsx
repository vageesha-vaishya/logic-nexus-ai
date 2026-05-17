/**
 * AMRO Enterprise Materials Editor - WORKING VERSION
 * 
 * Direct Supabase integration (no API routing issues)
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
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
import { useAuth } from '@/hooks/useAuth';
import { logger } from "@/lib/logger";

interface PartInventory {
  id: string;
  part_number: string;
  description: string;
  ata_chapter?: string;
  material_group?: string;
  quantity_available: number;
  unit_cost: number;
  criticality?: string;
}

interface MaterialLineItem {
  id: string;
  inventory_id: string;
  part_number: string;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  ata_chapter?: string;
  material_group?: string;
  stock_available?: number;
  is_critical?: boolean;
}

interface EnterpriseMaterialsEditorProps {
  materials: MaterialLineItem[];
  onChange: (materials: MaterialLineItem[]) => void;
  workOrderTemplateId?: string;
  readOnly?: boolean;
}

export function EnterpriseMaterialsEditor({
  materials,
  onChange,
  readOnly = false,
}: EnterpriseMaterialsEditorProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PartInventory[]>([]);
  const [searching, setSearching] = useState(false);
  const { session } = useAuth();

  // Calculate total cost
  const totalCost = useMemo(() => {
    return materials.reduce((sum, mat) => sum + mat.total_cost, 0);
  }, [materials]);

  // Search parts inventory directly via Supabase
  const searchParts = useCallback(async (query: string) => {
    setSearching(true);
    try {
      let q = supabase
        .from('parts_inventory')
        .select('*')
        .limit(20);

      if (query) {
        q = q.or(`part_number.ilike.%${query}%,description.ilike.%${query}%`);
      }

      const { data, error } = await q;

      if (error) {
        logger.error('Search error:', error);
        setSearchResults([]);
      } else {
        setSearchResults(data || []);
      }
    } catch (error) {
      logger.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Add material from catalog
  const addFromCatalog = useCallback((part: PartInventory) => {
    const exists = materials.find((m) => m.inventory_id === part.id);
    if (exists) {
      return;
    }

    const newMaterial: MaterialLineItem = {
      id: crypto.randomUUID(),
      inventory_id: part.id,
      part_number: part.part_number,
      description: part.description,
      quantity: 1,
      unit_cost: part.unit_cost || 0,
      total_cost: part.unit_cost || 0,
      ata_chapter: part.ata_chapter,
      material_group: part.material_group,
      stock_available: part.quantity_available,
      is_critical: part.criticality === 'critical',
    };

    onChange([...materials, newMaterial]);
  }, [materials, onChange]);

  // Update material
  const updateMaterial = useCallback((id: string, updates: Partial<MaterialLineItem>) => {
    const updated = materials.map((mat) => {
      if (mat.id === id) {
        const newMat = { ...mat, ...updates };
        newMat.total_cost = newMat.quantity * newMat.unit_cost;
        return newMat;
      }
      return mat;
    });
    onChange(updated);
  }, [materials, onChange]);

  // Remove material
  const removeMaterial = useCallback((id: string) => {
    onChange(materials.filter((mat) => mat.id !== id));
  }, [materials, onChange]);

  // Get stock status badge
  const getStockStatusBadge = (material: MaterialLineItem) => {
    const available = material.stock_available || 0;
    
    if (available <= 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Out of Stock
        </Badge>
      );
    } else if (available <= 10) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800">
          <AlertTriangle className="h-3 w-3" />
          Low ({available})
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="flex items-center gap-1 text-green-700">
          <CheckCircle className="h-3 w-3" />
          In Stock ({available})
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Enterprise Materials</h3>
          <p className="text-sm text-muted-foreground">
            {materials.length} materials • Total: ${totalCost.toFixed(2)}
          </p>
        </div>
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchOpen(true);
              searchParts('');
            }}
          >
            <Search className="h-4 w-4 mr-2" />
            Add from Inventory
          </Button>
        )}
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Materials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{materials.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critical Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {materials.filter((m) => m.is_critical).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Materials Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part Number</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>ATA</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit Cost</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Stock</TableHead>
              {!readOnly && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((material) => (
              <TableRow key={material.id} className={material.is_critical ? 'bg-red-50' : ''}>
                <TableCell className="font-mono">{material.part_number}</TableCell>
                <TableCell>{material.description}</TableCell>
                <TableCell>{material.ata_chapter || '-'}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={material.quantity}
                    onChange={(e) =>
                      updateMaterial(material.id, { quantity: Number(e.target.value) })
                    }
                    disabled={readOnly}
                    className="h-8 w-20"
                    min={1}
                  />
                </TableCell>
                <TableCell>${material.unit_cost.toFixed(2)}</TableCell>
                <TableCell className="font-semibold">
                  ${material.total_cost.toFixed(2)}
                </TableCell>
                <TableCell>{getStockStatusBadge(material)}</TableCell>
                {!readOnly && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMaterial(material.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {materials.length === 0 && (
              <TableRow>
                <TableCell colSpan={readOnly ? 7 : 8} className="text-center py-8 text-muted-foreground">
                  No materials added. Click "Add from Inventory" to search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Search Parts Inventory</DialogTitle>
            <DialogDescription>
              Search and select materials from parts inventory
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search by part number or description..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchParts(e.target.value);
              }}
            />
            {searching && <div className="text-center py-4">Searching...</div>}
            {!searching && searchResults.length > 0 && (
              <div className="border rounded-lg max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part Number</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((part) => (
                      <TableRow key={part.id}>
                        <TableCell className="font-mono">{part.part_number}</TableCell>
                        <TableCell>{part.description}</TableCell>
                        <TableCell>
                          {part.quantity_available > 0 ? (
                            <Badge variant="outline" className="text-green-700">
                              {part.quantity_available}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">0</Badge>
                          )}
                        </TableCell>
                        <TableCell>${part.unit_cost}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => addFromCatalog(part)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {!searching && searchResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No parts found. Try a different search term.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
