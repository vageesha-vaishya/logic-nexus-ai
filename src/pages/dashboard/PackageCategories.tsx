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
  const { supabase, scopedDb, context } = useCRM();
  const [categories, setCategories] = useState<PackageCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PackageCategoryRow | null>(null);

  const fetchCategories = async () => {
    const isPlatform = context.isPlatformAdmin;
    const tenantId = context.tenantId;
    
    // ScopedDb handles the check for tenantId if not platform admin
    if (!isPlatform && !tenantId) return;

    try {
      // Use scopedDb for automatic tenant filtering
      let query = scopedDb.from("package_categories").select("*");
      
      // No need to manually filter by tenant_id for non-platform admins
      // scopedDb handles it.
      
      const { data, error } = await query.order("category_name");

      if (error) {
        console.error("Error fetching package categories:", error);
        return;
      }

      const rows = (data as PackageCategoryRow[]) || [];
      
      // Dev-only: auto-seed demo categories if none exist (only when tenant scoped)
      // Note: scopedDb.insert will auto-inject tenant_id
      if (!isPlatform && rows.length === 0 && import.meta.env.DEV) {
        try {
          await scopedDb.from("package_categories").insert([
            {
              // tenant_id is injected by scopedDb
              category_name: "Container",
              category_code: "CONT",
              description: "Standard shipping containers",
              is_active: true,
            },
            {
              category_name: "Palletized",
              category_code: "PAL",
              description: "Goods packed on pallets",
              is_active: true,
            },
            {
              category_name: "Loose",
              category_code: "LOOSE",
              description: "Loose cargo items",
              is_active: false,
            },
          ] as any);
          
          toast.success("Seeded demo package categories");
          const { data: seeded } = await scopedDb
            .from("package_categories")
            .select("*")
            .order("category_name");
          setCategories((seeded as PackageCategoryRow[]) || []);
        } catch (seedErr: any) {
          console.warn("Package categories seed failed:", seedErr?.message || seedErr);
          setCategories([]);
        }
      } else {
        setCategories(rows);
      }
    } catch (err) {
      console.error("Error in fetchCategories:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: any) => {
    try {
      if (editingCategory) {
        const { error } = await scopedDb
          .from("package_categories")
          .update({
            category_name: data.category_name,
            category_code: data.category_code,
            description: data.description,
            is_active: data.is_active,
          })
          .eq("id", editingCategory.id);
        if (error) throw error;
        toast.success("Category updated");
      } else {
        const { error } = await scopedDb.from("package_categories").insert([
          {
            // tenant_id injected by scopedDb
            category_name: data.category_name,
            category_code: data.category_code,
            description: data.description,
            is_active: data.is_active,
          },
        ] as any);
        if (error) throw error;
        toast.success("Category created");
      }
      setIsDialogOpen(false);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || "Failed to save category");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await scopedDb.from("package_categories").delete().eq("id", id);
      if (error) throw error;
      toast.success("Category deleted");
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete category");
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