import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, PackageCheck } from "lucide-react";
import { useCRM } from "@/hooks/useCRM";
import { toast } from "sonner";
import { CargoDetailsForm } from "@/components/logistics/CargoDetailsForm";

type CargoDetail = {
  id: string;
  tenant_id?: string;
  service_type?: string;
  service_id?: string;
  cargo_type_id?: string | null;
  commodity_description?: string | null;
  hs_code?: string | null;
  package_count?: number | null;
  total_weight_kg?: number | null;
  total_volume_cbm?: number | null;
  hazmat?: boolean | null;
  hazmat_class?: string | null;
  temperature_controlled?: boolean | null;
  requires_special_handling?: boolean | null;
  notes?: string | null;
  is_active?: boolean | null;
  [key: string]: any; // Allow additional fields from database
};

export default function CargoDetails() {
  const { supabase, context } = useCRM();
  const [details, setDetails] = useState<CargoDetail[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [cargoTypes, setCargoTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<CargoDetail | null>(null);

  async function fetchData() {
    if (!context.tenantId) return;
    setLoading(true);
    try {
      const [{ data: cd }, { data: svc }, { data: ct }] = await Promise.all([
        supabase.from("cargo_details").select("*").eq("tenant_id", context.tenantId),
        supabase.from("services").select("id, service_name, service_type, service_code").eq("tenant_id", context.tenantId),
        supabase.from("cargo_types").select("id, cargo_type_name").eq("tenant_id", context.tenantId),
      ]);
      setDetails((cd || []) as CargoDetail[]);
      setServices(svc || []);
      setCargoTypes(ct || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load cargo details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.tenantId]);

  const serviceMap = useMemo(() => {
    const m: Record<string, string> = {};
    services.forEach((s) => {
      m[String(s.id)] = `${s.service_name}${s.service_code ? ` (${s.service_code})` : ''}`;
    });
    return m;
  }, [services]);

  const cargoTypeMap = useMemo(() => {
    const m: Record<string, string> = {};
    cargoTypes.forEach((c) => {
      m[String(c.id)] = c.cargo_type_name;
    });
    return m;
  }, [cargoTypes]);

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("cargo_details").delete().eq("id", id);
      if (error) throw error;
      toast.success("Cargo details deleted");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cargo Details</h1>
            <p className="text-muted-foreground">Configure cargo details by service type and service</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Cargo Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Cargo Details</DialogTitle>
              </DialogHeader>
              <CargoDetailsForm onSuccess={() => { setOpen(false); fetchData(); }} />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configured Cargo Details</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading cargo details...</div>
            ) : details.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No cargo details found. Create your first record to get started.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Cargo Type</TableHead>
                    <TableHead>Packages</TableHead>
                    <TableHead>Weight (kg)</TableHead>
                    <TableHead>Volume (cbm)</TableHead>
                    <TableHead>Hazmat</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="capitalize">{d.service_type?.replace(/_/g, " ")}</TableCell>
                      <TableCell>{serviceMap[String(d.service_id)] || d.service_id}</TableCell>
                      <TableCell>{d.cargo_type_id ? cargoTypeMap[String(d.cargo_type_id)] : '-'}</TableCell>
                      <TableCell>{d.package_count ?? '-'}</TableCell>
                      <TableCell>{d.total_weight_kg ?? '-'}</TableCell>
                      <TableCell>{d.total_volume_cbm ?? '-'}</TableCell>
                      <TableCell>{d.hazmat ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{d.is_active ? 'Active' : 'Inactive'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => { setEditItem(d); setEditOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Cargo Details</DialogTitle>
            </DialogHeader>
            {editItem && (
              <CargoDetailsForm initialData={editItem} onSuccess={() => { setEditOpen(false); setEditItem(null); fetchData(); }} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}