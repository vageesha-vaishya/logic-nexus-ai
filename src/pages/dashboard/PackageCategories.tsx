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
import type { Database } from "@/integrations/supabase/types";

type PackageCategoryRow = Database["public"]["Tables"]["package_categories"]["Row"];

export default function PackageCategories() {
  const { supabase, scopedDb, context } = useCRM();
  const [categories, setCategories] = useState<PackageCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PackageCategoryRow | null>(null);

  const fetchCategories = async () => {
    const isPlatform = context.isPlatformAdmin;
    const tenantId = context.tenantId;
    
    if (!isPlatform && !tenantId) return;

    try {
      const query = scopedDb.from("package_categories").select("*");
      const { data, error } = await query.order("category_name");

      if (error) {
        console.error("Error fetching package categories:", error);
        return;
      }

      const rows = (data as PackageCategoryRow[]) || [];
      setCategories(rows);
    } catch (err) {
      console.error("Error in fetchCategories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [context.tenantId]);

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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                  setIsDialogOpen(false);
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
