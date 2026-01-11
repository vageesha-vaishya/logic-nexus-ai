import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IncotermForm } from "@/components/logistics/IncotermForm";
import { useCRM } from "@/hooks/useCRM";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Incoterms() {
  const { supabase, scopedDb, context } = useCRM();
  const [incoterms, setIncoterms] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchIncoterms();
  }, [context.isPlatformAdmin, context.tenantId]);

  const fetchIncoterms = async () => {
    try {
      const { data, error } = await scopedDb.from("incoterms").select("*").order("incoterm_code");

      if (error) {
        console.error("Error fetching incoterms:", error);
        return;
      }

      const rows = data || [];
      setIncoterms(rows);

      // Dev-only: auto-seed demo incoterms if none exist
      const isPlatform = context.isPlatformAdmin;
      const tenantId = context.tenantId;
      
      if (!isPlatform && tenantId && rows.length === 0 && import.meta.env.DEV) {
        try {
          await scopedDb.from("incoterms").insert([
            {
              incoterm_code: "FOB",
              incoterm_name: "Free On Board",
              description: "Seller delivers goods on board the vessel at the named port of shipment.",
              is_active: true,
            },
            {
              incoterm_code: "CIF",
              incoterm_name: "Cost, Insurance and Freight",
              description: "Seller covers cost, insurance, and freight to port of destination.",
              is_active: true,
            },
            {
              incoterm_code: "EXW",
              incoterm_name: "Ex Works",
              description: "Buyer bears all costs and risks involved in taking goods from seller's premises to desired destination.",
              is_active: false,
            },
          ]);
          toast.success("Seeded demo incoterms");
          const { data: seeded } = await scopedDb
            .from("incoterms")
            .select("*")
            .order("incoterm_code");
          setIncoterms(seeded || []);
        } catch (seedErr: any) {
          console.warn("Incoterms seed failed:", seedErr?.message || seedErr);
        }
      }
    } catch (err) {
      console.error("Unexpected error fetching incoterms:", err);
    }
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