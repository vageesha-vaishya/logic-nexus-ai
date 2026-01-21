import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCRM } from "@/hooks/useCRM";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export default function VesselTypes() {
  type VesselType = Database['public']['Tables']['vessel_types']['Row'];
  const { scopedDb } = useCRM();
  const [types, setTypes] = useState<VesselType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newType, setNewType] = useState({ name: '', code: '', description: '' });

  const loadTypes = async () => {
    setLoading(true);
    const { data, error } = await scopedDb.from('vessel_types').select('*').order('name');
    if (error) {
      toast.error('Failed to load vessel types');
      console.error(error);
    } else {
      setTypes(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadTypes(); }, []);

  const handleSave = async () => {
    if (!newType.name || !newType.code) {
      toast.error('Name and Code are required');
      return;
    }
    const { error } = await scopedDb.from('vessel_types').insert(newType);
    if (error) {
      toast.error('Failed to create vessel type');
      console.error(error);
    } else {
      toast.success('Vessel type created');
      setIsDialogOpen(false);
      setNewType({ name: '', code: '', description: '' });
      loadTypes();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This may affect linked classes.')) return;
    const { error } = await scopedDb.from('vessel_types').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete vessel type');
    } else {
      toast.success('Vessel type deleted');
      loadTypes();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Vessel Types</h1>
            <p className="text-muted-foreground">Manage types of vessels (Container, Bulk, etc.)</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Type</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Vessel Type</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={newType.name} onChange={e => setNewType({ ...newType, name: e.target.value })} placeholder="Container Ship" />
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={newType.code} onChange={e => setNewType({ ...newType, code: e.target.value })} placeholder="CONT" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={newType.description} onChange={e => setNewType({ ...newType, description: e.target.value })} />
                </div>
                <Button onClick={handleSave} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((type) => (
              <TableRow key={type.id}>
                <TableCell>{type.name}</TableCell>
                <TableCell>{type.code}</TableCell>
                <TableCell>{type.description}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(type.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && types.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No vessel types found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
}
