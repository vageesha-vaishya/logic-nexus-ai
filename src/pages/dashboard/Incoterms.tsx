import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IncotermForm } from "@/components/logistics/IncotermForm";
import { useCRM } from "@/hooks/useCRM";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Incoterms() {
  const { supabase, context } = useCRM();
  const [incoterms, setIncoterms] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (context.tenantId) {
      fetchIncoterms();
    }
  }, [context.tenantId]);

  const fetchIncoterms = async () => {
    if (!context.tenantId) return;

    const { data, error } = await supabase
      .from("incoterms")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .order("incoterm_code");

    if (error) {
      console.error("Error fetching incoterms:", error);
      return;
    }

    setIncoterms(data || []);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Incoterms</h1>
          <p className="text-muted-foreground">Manage international commercial terms for quotations</p>
        </div>
        <div className="space-y-4">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Incoterm
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Incoterm</DialogTitle>
              </DialogHeader>
              <IncotermForm
                onSuccess={() => {
                  setOpen(false);
                  fetchIncoterms();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incoterms.map((incoterm) => (
              <TableRow key={incoterm.id}>
                <TableCell className="font-medium">{incoterm.incoterm_code}</TableCell>
                <TableCell>{incoterm.incoterm_name}</TableCell>
                <TableCell className="max-w-md truncate">{incoterm.description}</TableCell>
                <TableCell>
                  <Badge variant={incoterm.is_active ? "default" : "secondary"}>
                    {incoterm.is_active ? "Active" : "Inactive"}
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