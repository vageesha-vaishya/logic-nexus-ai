import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCRM } from "@/hooks/useCRM";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export default function VesselClasses() {
  type VesselClass = Database['public']['Tables']['vessel_classes']['Row'];
  type VesselType = Database['public']['Tables']['vessel_types']['Row'];

  const { scopedDb } = useCRM();
  const [classes, setClasses] = useState<VesselClass[]>([]);
  const [types, setTypes] = useState<VesselType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newClass, setNewClass] = useState({
    name: '',
    type_id: '',
    min_teu: 0,
    max_teu: 0,
    draft_limit_meters: 0,
    beam_limit_meters: 0
  });

  const loadData = async () => {
    setLoading(true);
    const [classesRes, typesRes] = await Promise.all([
      scopedDb.from('vessel_classes').select('*').order('name'),
      scopedDb.from('vessel_types').select('*').order('name')
    ]);

    if (classesRes.error) toast.error('Failed to load classes');
    if (typesRes.error) toast.error('Failed to load types');

    setClasses(classesRes.data || []);
    setTypes(typesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    if (!newClass.name || !newClass.type_id) {
      toast.error('Name and Type are required');
      return;
    }
    const { error } = await scopedDb.from('vessel_classes').insert({
      ...newClass,
      min_teu: newClass.min_teu || null,
      max_teu: newClass.max_teu || null,
      draft_limit_meters: newClass.draft_limit_meters || null,
      beam_limit_meters: newClass.beam_limit_meters || null
    });

    if (error) {
      toast.error('Failed to create vessel class');
      console.error(error);
    } else {
      toast.success('Vessel class created');
      setIsDialogOpen(false);
      setNewClass({
        name: '',
        type_id: '',
        min_teu: 0,
        max_teu: 0,
        draft_limit_meters: 0,
        beam_limit_meters: 0
      });
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    const { error } = await scopedDb.from('vessel_classes').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete class');
    } else {
      toast.success('Class deleted');
      loadData();
    }
  };

  const getTypeName = (id: string | null) => types.find(t => t.id === id)?.name || id;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Vessel Classes</h1>
            <p className="text-muted-foreground">Define classes (e.g., Panamax, Suezmax) and constraints.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Class</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Add Vessel Class</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2 col-span-2">
                  <Label>Name</Label>
                  <Input value={newClass.name} onChange={e => setNewClass({ ...newClass, name: e.target.value })} placeholder="Post-Panamax" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Type</Label>
                  <Select value={newClass.type_id} onValueChange={v => setNewClass({ ...newClass, type_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                    <SelectContent>
                      {types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Min TEU</Label>
                  <Input type="number" value={newClass.min_teu} onChange={e => setNewClass({ ...newClass, min_teu: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Max TEU</Label>
                  <Input type="number" value={newClass.max_teu} onChange={e => setNewClass({ ...newClass, max_teu: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Draft Limit (m)</Label>
                  <Input type="number" step="0.1" value={newClass.draft_limit_meters} onChange={e => setNewClass({ ...newClass, draft_limit_meters: parseFloat(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Beam Limit (m)</Label>
                  <Input type="number" step="0.1" value={newClass.beam_limit_meters} onChange={e => setNewClass({ ...newClass, beam_limit_meters: parseFloat(e.target.value) })} />
                </div>
                <Button onClick={handleSave} className="col-span-2 mt-4">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>TEU Range</TableHead>
              <TableHead>Dimensions (Draft/Beam)</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{getTypeName(c.type_id)}</TableCell>
                <TableCell>{c.min_teu || 0} - {c.max_teu || 'Unl'}</TableCell>
                <TableCell>{c.draft_limit_meters || '-'}m / {c.beam_limit_meters || '-'}m</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
}
