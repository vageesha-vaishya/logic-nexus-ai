
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, ShieldAlert, Archive, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RetentionPolicyDialog } from "./RetentionPolicyDialog";
import { LegalHoldDialog } from "./LegalHoldDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ComplianceSettings() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [holds, setHolds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);
  
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const [selectedHold, setSelectedHold] = useState<any>(null);

  const { toast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: pData, error: pError } = await supabase
        .from("compliance_retention_policies")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (pError) throw pError;
      setPolicies(pData || []);

      const { data: hData, error: hError } = await supabase
        .from("compliance_legal_holds")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (hError) throw hError;
      setHolds(hData || []);

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const deleteItem = async (table: string, id: string) => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;
    try {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Item removed successfully." });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-lg font-semibold">Compliance Management</h2>
           <p className="text-sm text-muted-foreground">Manage data retention policies and legal holds.</p>
        </div>
      </div>

      <Tabs defaultValue="retention" className="w-full">
        <TabsList>
          <TabsTrigger value="retention" className="flex items-center gap-2">
            <Archive className="w-4 h-4" /> Retention Policies
          </TabsTrigger>
          <TabsTrigger value="holds" className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Legal Holds
          </TabsTrigger>
        </TabsList>

        <TabsContent value="retention" className="mt-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Retention Policies</CardTitle>
                        <CardDescription>Automatically archive or delete old emails based on rules.</CardDescription>
                    </div>
                    <Button onClick={() => { setSelectedPolicy(null); setShowPolicyDialog(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> New Policy
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {policies.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No retention policies defined.</p>
                        ) : (
                            policies.map(policy => (
                                <div key={policy.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{policy.name}</span>
                                            {policy.is_active ? 
                                                <Badge variant="outline" className="text-green-600 bg-green-50">Active</Badge> : 
                                                <Badge variant="outline" className="text-gray-500">Inactive</Badge>
                                            }
                                        </div>
                                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                                            <Badge variant="secondary" className="text-xs">{policy.scope}</Badge>
                                            {policy.scope_value && <span className="font-mono text-xs">{policy.scope_value}</span>}
                                            <span>•</span>
                                            <span>Retain {policy.retention_days} days</span>
                                            <span>•</span>
                                            <span className="capitalize text-primary">{policy.action.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => { setSelectedPolicy(policy); setShowPolicyDialog(true); }}>
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => deleteItem('compliance_retention_policies', policy.id)}>
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="holds" className="mt-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Legal Holds</CardTitle>
                        <CardDescription>Prevent deletion of data for legal or investigation purposes.</CardDescription>
                    </div>
                    <Button variant="destructive" onClick={() => { setSelectedHold(null); setShowHoldDialog(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> New Hold
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {holds.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No active legal holds.</p>
                        ) : (
                            holds.map(hold => (
                                <div key={hold.id} className="flex items-center justify-between p-4 border rounded-lg bg-red-50/10 border-red-100 hover:bg-red-50/20 transition-colors">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <ShieldAlert className="w-4 h-4 text-red-500" />
                                            <span className="font-medium text-red-900 dark:text-red-200">{hold.name}</span>
                                            {hold.is_active ? 
                                                <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50">Active</Badge> : 
                                                <Badge variant="outline" className="text-gray-500">Inactive</Badge>
                                            }
                                        </div>
                                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                                            <span className="capitalize">{hold.target_type.replace('_', ' ')}</span>: 
                                            <span className="font-mono">{hold.target_value}</span>
                                            {hold.end_date && <span>• Ends: {new Date(hold.end_date).toLocaleDateString()}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => { setSelectedHold(hold); setShowHoldDialog(true); }}>
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => deleteItem('compliance_legal_holds', hold.id)}>
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      <RetentionPolicyDialog 
        open={showPolicyDialog} 
        onOpenChange={setShowPolicyDialog} 
        policy={selectedPolicy} 
        onSuccess={fetchData} 
      />
      
      <LegalHoldDialog 
        open={showHoldDialog} 
        onOpenChange={setShowHoldDialog} 
        hold={selectedHold} 
        onSuccess={fetchData} 
      />
    </div>
  );
}
