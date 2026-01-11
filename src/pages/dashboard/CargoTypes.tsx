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
  const { supabase, scopedDb, context } = useCRM();
  type CargoTypeRow = Database["public"]["Tables"]["cargo_types"]["Row"];
  const [cargoTypes, setCargoTypes] = useState<CargoTypeRow[]>([]);
  const [open, setOpen] = useState(false);

  const fetchCargoTypes = useCallback(async () => {
    try {
      const { data, error } = await scopedDb
        .from("cargo_types")
        .select("*")
        .order("cargo_type_name");

      if (error) {
        console.error("Error fetching cargo types:", error);
        return;
      }

      const rows = (data || []) as CargoTypeRow[];
      setCargoTypes(rows);
      
      // Dev-only: auto-seed demo cargo types if none exist
      // We keep using raw supabase for seeding to ensure we can explicitly set data if needed,
      // but strictly speaking scopedDb could work too. For safety in this refactor, 
      // we'll leave the seeding logic mostly as is but check against the data we just fetched.
      const isPlatform = context.isPlatformAdmin;
      const tenantId = context.tenantId;
      
      if (!isPlatform && tenantId && rows.length === 0 && import.meta.env.DEV) {
        try {
          await scopedDb.from("cargo_types").insert([
            {
              cargo_type_name: "General Cargo",
              cargo_code: "GEN",
              hazmat_class: null,
              temperature_controlled: false,
              requires_special_handling: false,
              is_active: true,
            },
            {
              cargo_type_name: "Perishable Goods",
              cargo_code: "PER",
              hazmat_class: null,
              temperature_controlled: true,
              requires_special_handling: false,
              is_active: true,
            },
            {
              cargo_type_name: "Hazardous Materials",
              cargo_code: "HAZ",
              hazmat_class: "Class 3",
              temperature_controlled: false,
              requires_special_handling: true,
              is_active: true,
            },
            {
              cargo_type_name: "Oversized Machinery",
              cargo_code: "OVS",
              hazmat_class: null,
              temperature_controlled: false,
              requires_special_handling: true,
              is_active: false,
            },
          ]);
          toast.success("Seeded demo cargo types");
          // Re-fetch using scopedDb
          const { data: seeded } = await scopedDb
            .from("cargo_types")
            .select("*")
            .order("cargo_type_name");
          setCargoTypes((seeded || []) as CargoTypeRow[]);
        } catch (seedErr: unknown) {
          const message = seedErr instanceof Error ? seedErr.message : String(seedErr);
          console.warn("Cargo types seed failed:", message);
        }
      }
    } catch (err) {
      console.error("Unexpected error fetching cargo types:", err);
    }
  }, [context.isPlatformAdmin, context.tenantId, scopedDb, supabase]);

  useEffect(() => {
    fetchCargoTypes();
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
                <TableCell className="font-medium">{cargo.cargo_type_name}</TableCell>
                <TableCell>{cargo.cargo_code || "-"}</TableCell>
                <TableCell>
                  {cargo.hazmat_class ? (
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
