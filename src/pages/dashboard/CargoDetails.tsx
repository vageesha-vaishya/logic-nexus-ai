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
import type { Database } from "@/integrations/supabase/types";

type CargoDetail = Database["public"]["Tables"]["cargo_details"]["Row"];

export default function CargoDetails() {
  const { supabase, context, scopedDb } = useCRM();
  const [details, setDetails] = useState<CargoDetail[]>([]);
  type ServiceRow = Pick<Database["public"]["Tables"]["services"]["Row"], "id" | "service_name" | "service_type" | "service_code">;
  type CargoTypeRow = { id: string; cargo_type_name: string };
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [cargoTypes, setCargoTypes] = useState<CargoTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<CargoDetail | null>(null);

  async function fetchData() {
    if (!context.tenantId) return;
    setLoading(true);
    try {
      const [{ data: cd }, { data: svc }, { data: ct }] = await Promise.all([
        scopedDb.from("cargo_details").select("*"),
        scopedDb.from("services").select("id, service_name, service_type, service_code"),
        scopedDb.from("cargo_types").select("id, cargo_type_name"),
      ]);
      setDetails((cd || []) as CargoDetail[]);
      setServices(svc || []);
      setCargoTypes((ct || []).map(c => ({ id: c.id, cargo_type_name: c.cargo_type_name })));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(message || "Failed to load cargo details");
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
      const { error } = await scopedDb.from("cargo_details").delete().eq("id", id);
      if (error) throw error;
      toast.success("Cargo details deleted");
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(message || "Failed to delete");
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
                      <TableCell>{d.weight_kg ?? '-'}</TableCell>
                      <TableCell>{d.volume_cbm ?? '-'}</TableCell>
                      <TableCell>{d.is_hazardous ? 'Yes' : 'No'}</TableCell>
                      <TableCell>Active</TableCell>
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
              <CargoDetailsForm
                initialData={{
                  id: editItem.id,
                  service_type: editItem.service_type || "",
                  service_id: editItem.service_id || "",
                  cargo_type_id: editItem.cargo_type_id || "",
                  commodity_description: editItem.commodity_description || "",
                  hs_code: editItem.hs_code || "",
                  aes_hts_id: editItem.aes_hts_id || "",
                  total_weight_kg: editItem.weight_kg ?? undefined,
                  total_volume_cbm: editItem.volume_cbm ?? undefined,
                  is_hazardous: !!editItem.is_hazardous,
                  hazmat_class: editItem.hazmat_class || "",
                  temperature_controlled: !!editItem.temperature_controlled,
                  notes: editItem.notes || "",
                  dimensions: (editItem as any).dimensions_cm ?? {},
                }}
                onSuccess={() => { setEditOpen(false); setEditItem(null); fetchData(); }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
