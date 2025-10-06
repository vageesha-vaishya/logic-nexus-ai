import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PackageCategoryForm } from "@/components/logistics/PackageCategoryForm";
import { useCRM } from "@/hooks/useCRM";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function PackageCategories() {
  const { supabase, context } = useCRM();
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (context.isPlatformAdmin || context.tenantId) {
      fetchCategories();
    }
  }, [context.isPlatformAdmin, context.tenantId]);

  const fetchCategories = async () => {
    const isPlatform = context.isPlatformAdmin;
    const tenantId = context.tenantId;
    if (!isPlatform && !tenantId) return;

    let query = supabase.from("package_categories").select("*");
    if (!isPlatform) {
      query = query.eq("tenant_id", tenantId as string);
    }
    const { data, error } = await query.order("category_name");

    if (error) {
      console.error("Error fetching package categories:", error);
      return;
    }

    const rows = data || [];
    // Dev-only: auto-seed demo categories if none exist (only when tenant scoped)
    if (!isPlatform && rows.length === 0 && import.meta.env.DEV) {
      try {
        await supabase.from("package_categories").insert([
          {
            tenant_id: tenantId,
            category_name: "Container",
            category_code: "CONT",
            description: "Standard shipping containers",
            is_active: true,
          },
          {
            tenant_id: tenantId,
            category_name: "Palletized",
            category_code: "PAL",
            description: "Goods packed on pallets",
            is_active: true,
          },
          {
            tenant_id: tenantId,
            category_name: "Loose",
            category_code: "LOOSE",
            description: "Loose cargo items",
            is_active: false,
          },
        ]);
        toast.success("Seeded demo package categories");
        const { data: seeded } = await supabase
          .from("package_categories")
          .select("*")
          .eq("tenant_id", tenantId as string)
          .order("category_name");
        setCategories(seeded || []);
      } catch (seedErr: any) {
        console.warn("Package categories seed failed:", seedErr?.message || seedErr);
        setCategories([]);
      }
    } else {
      setCategories(rows);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Package Categories</h1>
          <p className="text-muted-foreground">Manage container and package categories for quotations</p>
        </div>
        <div className="space-y-4">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Package Category</DialogTitle>
              </DialogHeader>
              <PackageCategoryForm
                onSuccess={() => {
                  setOpen(false);
                  fetchCategories();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.category_name}</TableCell>
                <TableCell>{category.category_code}</TableCell>
                <TableCell>{category.description}</TableCell>
                <TableCell>
                  <Badge variant={category.is_active ? "default" : "secondary"}>
                    {category.is_active ? "Active" : "Inactive"}
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