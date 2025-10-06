import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PackageSizeForm } from "@/components/logistics/PackageSizeForm";
import { useCRM } from "@/hooks/useCRM";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function PackageSizes() {
  const { supabase, context } = useCRM();
  const [sizes, setSizes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (context.tenantId) {
      fetchSizes();
    }
  }, [context.tenantId]);

  const fetchSizes = async () => {
    if (!context.tenantId) return;

    const { data, error } = await supabase
      .from("package_sizes")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .order("size_name");

    if (error) {
      console.error("Error fetching package sizes:", error);
      return;
    }

    setSizes(data || []);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Package Sizes</h1>
          <p className="text-muted-foreground">Manage container and package sizes for quotations</p>
        </div>
        <div className="space-y-4">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Size
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Package Size</DialogTitle>
              </DialogHeader>
              <PackageSizeForm
                onSuccess={() => {
                  setOpen(false);
                  fetchSizes();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Size Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Dimensions (ft)</TableHead>
              <TableHead>Max Weight (kg)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sizes.map((size) => (
              <TableRow key={size.id}>
                <TableCell className="font-medium">{size.size_name}</TableCell>
                <TableCell>{size.size_code}</TableCell>
                <TableCell>
                  {size.length_ft && size.width_ft && size.height_ft
                    ? `${size.length_ft}' × ${size.width_ft}' × ${size.height_ft}'`
                    : "-"}
                </TableCell>
                <TableCell>{size.max_weight_kg || "-"}</TableCell>
                <TableCell>
                  <Badge variant={size.is_active ? "default" : "secondary"}>
                    {size.is_active ? "Active" : "Inactive"}
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