import { useState, useEffect, useCallback } from "react";
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
import type { Database } from "@/integrations/supabase/types";

export default function CargoTypes() {
  const { supabase, context } = useCRM();
  type CargoTypeRow = Database["public"]["Tables"]["cargo_types"]["Row"];
  const [cargoTypes, setCargoTypes] = useState<CargoTypeRow[]>([]);
  const [open, setOpen] = useState(false);

  const fetchCargoTypes = useCallback(async () => {
    const isPlatform = context.isPlatformAdmin;
    const tenantId = context.tenantId;
    if (!isPlatform && !tenantId) return;

    let query = supabase
      .from("cargo_types")
      .select("*");
    if (!isPlatform) {
      query = query.eq("tenant_id", tenantId as string);
    }
    const { data, error } = await query.order("name");

    if (error) {
      console.error("Error fetching cargo types:", error);
      return;
    }

    const rows = (data || []) as CargoTypeRow[];
    // Dev-only: auto-seed demo cargo types if none exist (only when tenant scoped)
    if (!isPlatform && rows.length === 0 && import.meta.env.DEV) {
      try {
        await supabase.from("cargo_types").insert([
          {
            tenant_id: tenantId,
            name: "General Cargo",
            code: "GEN",
            is_hazardous: false,
            requires_temperature_control: false,
            is_active: true,
          },
          {
            tenant_id: tenantId,
            name: "Perishable Goods",
            code: "PER",
            is_hazardous: false,
            requires_temperature_control: true,
            is_active: true,
          },
          {
            tenant_id: tenantId,
            name: "Hazardous Materials",
            code: "HAZ",
            is_hazardous: true,
            requires_temperature_control: false,
            is_active: true,
          },
          {
            tenant_id: tenantId,
            name: "Oversized Machinery",
            code: "OVS",
            is_hazardous: false,
            requires_temperature_control: false,
            is_active: false,
          },
        ]);
        toast.success("Seeded demo cargo types");
        const { data: seeded } = await supabase
          .from("cargo_types")
          .select("*")
          .eq("tenant_id", tenantId as string)
          .order("name");
        setCargoTypes((seeded || []) as CargoTypeRow[]);
      } catch (seedErr: unknown) {
        const message = seedErr instanceof Error ? seedErr.message : String(seedErr);
        console.warn("Cargo types seed failed:", message);
        setCargoTypes([]);
      }
    } else {
      setCargoTypes(rows);
    }
  }, [context.isPlatformAdmin, context.tenantId, supabase]);

  useEffect(() => {
    if (context.isPlatformAdmin || context.tenantId) {
      fetchCargoTypes();
    }
  }, [context.isPlatformAdmin, context.tenantId, fetchCargoTypes]);


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
              <TableHead>Hazardous</TableHead>
              <TableHead>Temperature Control</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargoTypes.map((cargo) => (
              <TableRow key={cargo.id}>
                <TableCell className="font-medium">{cargo.name}</TableCell>
                <TableCell>{cargo.code || "-"}</TableCell>
                <TableCell>
                  {cargo.is_hazardous ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell>
                  {cargo.requires_temperature_control ? (
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
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
