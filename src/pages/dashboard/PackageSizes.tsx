import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PackageSizeForm } from "@/components/logistics/PackageSizeForm";
import { useCRM } from "@/hooks/useCRM";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function PackageSizes() {
  const { supabase, context } = useCRM();
  const [sizes, setSizes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (context.isPlatformAdmin || context.tenantId) {
      fetchSizes();
    }
  }, [context.isPlatformAdmin, context.tenantId]);

  const fetchSizes = async () => {
    const isPlatform = context.isPlatformAdmin;
    const tenantId = context.tenantId;
    if (!isPlatform && !tenantId) return;

    let query = supabase.from("package_sizes").select("*");
    if (!isPlatform) {
      query = query.eq("tenant_id", tenantId as string);
    }
    const { data, error } = await query.order("size_name");

    if (error) {
      console.error("Error fetching package sizes:", error);
      return;
    }

    const rows = data || [];
    // Dev-only: auto-seed demo sizes if none exist (only when tenant scoped)
    if (!isPlatform && rows.length === 0 && import.meta.env.DEV) {
      try {
        await supabase.from("package_sizes").insert([
          {
            tenant_id: tenantId,
            size_name: "20ft Container",
            size_code: "20FT",
            length_ft: 20,
            width_ft: 8,
            height_ft: 8.5,
            max_weight_kg: 28200,
            is_active: true,
          },
          {
            tenant_id: tenantId,
            size_name: "40ft Container",
            size_code: "40FT",
            length_ft: 40,
            width_ft: 8,
            height_ft: 8.5,
            max_weight_kg: 30480,
            is_active: true,
          },
          {
            tenant_id: tenantId,
            size_name: "Pallet (48x40)",
            size_code: "PAL48x40",
            length_ft: 4,
            width_ft: 3.33,
            height_ft: null,
            max_weight_kg: 1000,
            is_active: false,
          },
        ]);
        toast.success("Seeded demo package sizes");
        const { data: seeded } = await supabase
          .from("package_sizes")
          .select("*")
          .eq("tenant_id", tenantId as string)
          .order("size_name");
        setSizes(seeded || []);
      } catch (seedErr: any) {
        console.warn("Package sizes seed failed:", seedErr?.message || seedErr);
        setSizes([]);
      }
    } else {
      setSizes(rows);
    }
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