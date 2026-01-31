import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RoleGuard } from '@/components/auth/RoleGuard';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Package, Search } from 'lucide-react';
import { CargoForm } from '@/components/logistics/CargoForm';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function LogisticsManager() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch Cargo Details
  const { data: cargoList, isLoading } = useQuery({
    queryKey: ['cargo_details', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('cargo_details')
        .select(`
          *,
          cargo_types (cargo_type_name),
          aes_hts_codes (hts_code, description)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('commodity_description', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase
        .from('cargo_details')
        .update({ is_active: false }) // Soft delete
        .eq('id', deletingId);
      
      if (error) throw error;
      toast.success("Cargo item deleted");
      queryClient.invalidateQueries({ queryKey: ['cargo_details'] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <RoleGuard roles={['platform_admin', 'tenant_admin']}>
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Logistics Management</h1>
            <p className="text-muted-foreground">Manage cargo inventory and HTS classifications.</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Cargo
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cargo Inventory</CardTitle>
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search commodities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commodity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>HTS / Schedule B</TableHead>
                    <TableHead>Stats</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargoList?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                        No cargo items found.
                      </TableCell>
                    </TableRow>
                  )}
                  {cargoList?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-blue-500" />
                          {item.commodity_description}
                        </div>
                        {item.hazmat && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full ml-2">
                            HAZMAT {item.hazmat_class}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{item.cargo_types?.cargo_type_name || '-'}</TableCell>
                      <TableCell>
                        {item.aes_hts_codes ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-xs">{item.aes_hts_codes.hts_code}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={item.aes_hts_codes.description}>
                              {item.aes_hts_codes.description.substring(0, 30)}...
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">Unclassified</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>Pkg: {item.package_count}</div>
                        <div>Wgt: {item.total_weight_kg} kg</div>
                        <div>Vol: {item.total_volume_cbm} cbm</div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingCargo(item)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setDeletingId(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Cargo Item</DialogTitle>
            </DialogHeader>
            <CargoForm
              onSuccess={() => {
                setIsCreateOpen(false);
                queryClient.invalidateQueries({ queryKey: ['cargo_details'] });
              }}
              onCancel={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingCargo} onOpenChange={(open) => !open && setEditingCargo(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Cargo Item</DialogTitle>
            </DialogHeader>
            {editingCargo && (
              <CargoForm
                cargoId={editingCargo.id}
                defaultValues={{
                    ...editingCargo,
                    // Map generic fields if needed
                }}
                onSuccess={() => {
                  setEditingCargo(null);
                  queryClient.invalidateQueries({ queryKey: ['cargo_details'] });
                }}
                onCancel={() => setEditingCargo(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action will mark the cargo item as inactive. It can be restored by an administrator.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RoleGuard>
  );
}
