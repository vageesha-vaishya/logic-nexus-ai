import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCRM } from "@/hooks/useCRM";
import { Plus, Trash2, Ship } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export default function Vessels() {
  type Vessel = Database['public']['Tables']['vessels']['Row'];
  type VesselClass = Database['public']['Tables']['vessel_classes']['Row'];
  type Carrier = Database['public']['Tables']['carriers']['Row'];

  const { scopedDb } = useCRM();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [classes, setClasses] = useState<VesselClass[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newVessel, setNewVessel] = useState({
    name: '',
    carrier_id: '',
    class_id: '',
    imo_number: '',
    flag_country: '',
    built_year: new Date().getFullYear(),
    capacity_teu: 0
  });

  const loadData = async () => {
    setLoading(true);
    const [vesselsRes, classesRes, carriersRes] = await Promise.all([
      scopedDb.from('vessels').select('*').order('name'),
      scopedDb.from('vessel_classes').select('*').order('name'),
      scopedDb.from('carriers').select('*').order('name')
    ]);

    if (vesselsRes.error) console.error(vesselsRes.error);
    
    setVessels(vesselsRes.data || []);
    setClasses(classesRes.data || []);
    setCarriers(carriersRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    if (!newVessel.name || !newVessel.imo_number) {
      toast.error('Name and IMO Number are required');
      return;
    }
    const { error } = await scopedDb.from('vessels').insert({
      ...newVessel,
      carrier_id: newVessel.carrier_id || null,
      class_id: newVessel.class_id || null,
    });

    if (error) {
      toast.error(error.message || 'Failed to create vessel');
    } else {
      toast.success('Vessel added');
      setIsDialogOpen(false);
      setNewVessel({
        name: '',
        carrier_id: '',
        class_id: '',
        imo_number: '',
        flag_country: '',
        built_year: new Date().getFullYear(),
        capacity_teu: 0
      });
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    const { error } = await scopedDb.from('vessels').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete vessel');
    } else {
      toast.success('Vessel deleted');
      loadData();
    }
  };

  const getClassName = (id: string | null) => classes.find(c => c.id === id)?.name || '-';
  const getCarrierName = (id: string | null) => carriers.find(c => c.id === id)?.name || '-';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Vessels</h1>
            <p className="text-muted-foreground">Manage fleet and vessel details.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Vessel</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Add New Vessel</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label>Vessel Name</Label>
                  <Input value={newVessel.name} onChange={e => setNewVessel({ ...newVessel, name: e.target.value })} placeholder="MSC OSCAR" />
                </div>
                <div className="space-y-2">
                  <Label>IMO Number</Label>
                  <Input value={newVessel.imo_number} onChange={e => setNewVessel({ ...newVessel, imo_number: e.target.value })} placeholder="9703291" />
                </div>
                
                <div className="space-y-2">
                  <Label>Carrier</Label>
                  <Select value={newVessel.carrier_id} onValueChange={v => setNewVessel({ ...newVessel, carrier_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select Carrier" /></SelectTrigger>
                    <SelectContent>
                      {carriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={newVessel.class_id} onValueChange={v => setNewVessel({ ...newVessel, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Flag Country</Label>
                  <Input value={newVessel.flag_country} onChange={e => setNewVessel({ ...newVessel, flag_country: e.target.value })} placeholder="Panama" />
                </div>
                <div className="space-y-2">
                  <Label>Built Year</Label>
                  <Input type="number" value={newVessel.built_year} onChange={e => setNewVessel({ ...newVessel, built_year: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Capacity (TEU)</Label>
                  <Input type="number" value={newVessel.capacity_teu} onChange={e => setNewVessel({ ...newVessel, capacity_teu: parseInt(e.target.value) })} />
                </div>

                <Button onClick={handleSave} className="col-span-2 mt-4">Save Vessel</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vessel</TableHead>
              <TableHead>IMO</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Flag</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vessels.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  <Ship className="h-4 w-4 text-muted-foreground" />
                  {v.name}
                </TableCell>
                <TableCell>{v.imo_number}</TableCell>
                <TableCell>{getCarrierName(v.carrier_id)}</TableCell>
                <TableCell>{getClassName(v.class_id)}</TableCell>
                <TableCell>{v.flag_country}</TableCell>
                <TableCell>{v.capacity_teu?.toLocaleString()} TEU</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}>
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
