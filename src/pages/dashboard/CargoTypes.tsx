import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CargoTypeForm } from "@/components/logistics/CargoTypeForm";
import { useCRM } from "@/hooks/useCRM";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function CargoTypes() {
  const { supabase, context } = useCRM();
  const [cargoTypes, setCargoTypes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (context.isPlatformAdmin || context.tenantId) {
      fetchCargoTypes();
    }
  }, [context.isPlatformAdmin, context.tenantId]);

  const fetchCargoTypes = async () => {
    const isPlatform = context.isPlatformAdmin;
    const tenantId = context.tenantId;
    if (!isPlatform && !tenantId) return;

    let query = supabase
      .from("cargo_types")
      .select("*");
    if (!isPlatform) {
      query = query.eq("tenant_id", tenantId as string);
    }
    const { data, error } = await query.order("cargo_type_name");

    if (error) {
      console.error("Error fetching cargo types:", error);
      return;
    }

    const rows = data || [];
    // Dev-only: auto-seed demo cargo types if none exist (only when tenant scoped)
    if (!isPlatform && rows.length === 0 && import.meta.env.DEV) {
      try {
        await supabase.from("cargo_types").insert([
          {
            tenant_id: tenantId,
            cargo_type_name: "General Cargo",
            cargo_code: "GEN",
            requires_special_handling: false,
            temperature_controlled: false,
            is_active: true,
          },
          {
            tenant_id: tenantId,
            cargo_type_name: "Perishable Goods",
            cargo_code: "PER",
            requires_special_handling: true,
            temperature_controlled: true,
            is_active: true,
          },
          {
            tenant_id: tenantId,
            cargo_type_name: "Hazardous Materials",
            cargo_code: "HAZ",
            requires_special_handling: true,
            temperature_controlled: false,
            hazmat_class: "Class 3",
            is_active: true,
          },
          {
            tenant_id: tenantId,
            cargo_type_name: "Oversized Machinery",
            cargo_code: "OVS",
            requires_special_handling: true,
            temperature_controlled: false,
            is_active: false,
          },
        ]);
        toast.success("Seeded demo cargo types");
        const { data: seeded } = await supabase
          .from("cargo_types")
          .select("*")
          .eq("tenant_id", tenantId as string)
          .order("cargo_type_name");
        setCargoTypes(seeded || []);
      } catch (seedErr: any) {
        console.warn("Cargo types seed failed:", seedErr?.message || seedErr);
        setCargoTypes([]);
      }
    } else {
      setCargoTypes(rows);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Cargo Types</h1>
          <p className="text-muted-foreground">Manage cargo types and classifications for quotations</p>
        </div>
        <div className="space-y-4">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Cargo Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Cargo Type</DialogTitle>
              </DialogHeader>
              <CargoTypeForm
                onSuccess={() => {
                  setOpen(false);
                  fetchCargoTypes();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cargo Type</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Special Handling</TableHead>
              <TableHead>Temperature Control</TableHead>
              <TableHead>Hazmat Class</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargoTypes.map((cargo) => (
              <TableRow key={cargo.id}>
                <TableCell className="font-medium">{cargo.cargo_type_name}</TableCell>
                <TableCell>{cargo.cargo_code}</TableCell>
                <TableCell>
                  {cargo.requires_special_handling ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell>
                  {cargo.temperature_controlled ? (
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell>{cargo.hazmat_class || "-"}</TableCell>
                <TableCell>
                  <Badge variant={cargo.is_active ? "default" : "secondary"}>
                    {cargo.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}