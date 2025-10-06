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

export default function CargoTypes() {
  const { supabase, context } = useCRM();
  const [cargoTypes, setCargoTypes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (context.tenantId) {
      fetchCargoTypes();
    }
  }, [context.tenantId]);

  const fetchCargoTypes = async () => {
    if (!context.tenantId) return;

    const { data, error } = await supabase
      .from("cargo_types")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .order("cargo_type_name");

    if (error) {
      console.error("Error fetching cargo types:", error);
      return;
    }

    setCargoTypes(data || []);
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