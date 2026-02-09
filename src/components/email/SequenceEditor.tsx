
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Clock, FileText, Save, ArrowRight, UserPlus } from "lucide-react";
import { useCRM } from "@/hooks/useCRM";
import { useToast } from "@/hooks/use-toast";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SequenceEditorProps {
  sequenceId?: string;
  onClose: () => void;
}

export function SequenceEditor({ sequenceId, onClose }: SequenceEditorProps) {
  const [sequence, setSequence] = useState<any>({ name: "", description: "", status: "draft" });
  const [steps, setSteps] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(!!sequenceId);
  const [saving, setSaving] = useState(false);
  const { scopedDb, context, user } = useCRM();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [sequenceId]);

  const loadData = async () => {
    if (!context?.tenantId) return;
    
    // Fetch Templates for dropdown
    const { data: tmplData } = await scopedDb.from("email_templates").select("id, name, subject");
    setTemplates(tmplData || []);

    if (sequenceId) {
      setLoading(true);
      // Fetch Sequence
      const { data: seqData, error: seqError } = await scopedDb
        .from("email_sequences")
        .select("*")
        .eq("id", sequenceId)
        .single();
        
      if (seqError) {
        toast({ title: "Error", description: seqError.message, variant: "destructive" });
        return;
      }
      setSequence(seqData);

      // Fetch Steps
      const { data: stepsData, error: stepsError } = await scopedDb
        .from("email_sequence_steps")
        .select("*")
        .eq("sequence_id", sequenceId)
        .order("step_order", { ascending: true });
        
      if (stepsError) {
         toast({ title: "Error loading steps", description: stepsError.message, variant: "destructive" });
      } else {
         setSteps(stepsData || []);
      }
      setLoading(false);
    }
  };

  const handleSaveSequence = async () => {
    if (!sequence.name) {
        toast({ title: "Name required", variant: "destructive" });
        return;
    }
    setSaving(true);
    try {
        const payload = {
            tenant_id: context?.tenantId,
            name: sequence.name,
            description: sequence.description,
            status: sequence.status,
            stop_on_reply: sequence.stop_on_reply ?? true,
            created_by: user?.id
        };

        let savedId = sequenceId;

        if (sequenceId) {
             await scopedDb.from("email_sequences").update(payload).eq("id", sequenceId);
        } else {
             const { data, error } = await scopedDb.from("email_sequences").insert(payload).select().single();
             if (error) throw error;
             savedId = data.id;
             setSequence(data);
        }

        // Save Steps
        // Simple approach: Delete all and recreate (not efficient for large lists but fine here)
        // Better: Upsert based on ID if exists, insert if new.
        
        if (savedId && steps.length > 0) {
            const stepsPayload = steps.map((step, index) => ({
                id: step.id?.length > 10 ? step.id : undefined, // Keep ID if valid UUID
                sequence_id: savedId,
                step_order: index + 1,
                template_id: step.template_id,
                delay_hours: parseInt(step.delay_hours) || 24,
                type: 'email'
            }));

            const { error: stepsErr } = await scopedDb.from("email_sequence_steps").upsert(stepsPayload);
            if (stepsErr) throw stepsErr;
        }

        toast({ title: "Saved successfully" });
        if (!sequenceId) onClose(); // Close if it was a new creation
    } catch (error: any) {
        toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } finally {
        setSaving(false);
    }
  };

  const addStep = () => {
    setSteps([...steps, { template_id: "", delay_hours: 24, type: "email", id: `temp-${Date.now()}` }]);
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const removeStep = async (index: number) => {
    const step = steps[index];
    if (step.id && !step.id.startsWith('temp-')) {
        // Delete from DB immediately to avoid sync issues
        await scopedDb.from("email_sequence_steps").delete().eq("id", step.id);
    }
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps);
  };
  
  const enrollTest = async () => {
      // Temporary helper to enroll self
      if (!sequenceId || !user?.email) return;
      try {
          await scopedDb.from("email_sequence_enrollments").insert({
              sequence_id: sequenceId,
              recipient_email: user.email, // Test with own email
              recipient_name: "Test User",
              status: "active",
              next_step_due_at: new Date().toISOString() // Due now
          });
          toast({ title: "Enrolled self for test" });
      } catch (err: any) {
          toast({ title: "Error", description: err.message });
      }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <DialogHeader className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
            <DialogTitle>{sequenceId ? "Edit Sequence" : "New Sequence"}</DialogTitle>
            <div className="flex gap-2">
                 {sequenceId && (
                     <Button variant="outline" size="sm" onClick={enrollTest}>
                        <UserPlus className="w-4 h-4 mr-2" /> Test Enroll Me
                     </Button>
                 )}
                 <Button onClick={handleSaveSequence} disabled={saving}>
                    {saving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Sequence</>}
                 </Button>
            </div>
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-hidden flex">
        {/* Left: Settings */}
        <div className="w-1/3 border-r p-6 space-y-6 overflow-y-auto">
            <div className="space-y-2">
                <Label>Sequence Name</Label>
                <Input 
                    value={sequence.name} 
                    onChange={(e) => setSequence({...sequence, name: e.target.value})} 
                    placeholder="e.g. Cold Outreach Q1"
                />
            </div>
            <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                    value={sequence.description || ""} 
                    onChange={(e) => setSequence({...sequence, description: e.target.value})} 
                    placeholder="Goal of this sequence..."
                />
            </div>
             <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                    value={sequence.status} 
                    onValueChange={(v) => setSequence({...sequence, status: v})}
                >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        {/* Right: Steps */}
        <div className="flex-1 bg-muted/20 flex flex-col">
            <div className="p-4 border-b bg-background flex justify-between items-center">
                <h3 className="font-semibold">Sequence Steps</h3>
                <Button size="sm" variant="outline" onClick={addStep}>
                    <Plus className="w-4 h-4 mr-2" /> Add Step
                </Button>
            </div>
            
            <ScrollArea className="flex-1 p-6">
                <div className="space-y-6 max-w-2xl mx-auto">
                    {steps.map((step, index) => (
                        <div key={index} className="relative">
                            {/* Connector Line */}
                            {index < steps.length - 1 && (
                                <div className="absolute left-6 top-12 bottom-[-24px] w-0.5 bg-border z-0" />
                            )}
                            
                            <Card className="relative z-10">
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                                {index + 1}
                                            </div>
                                            <span className="font-medium">Step {index + 1}</span>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => removeStep(index)} className="text-destructive hover:text-destructive">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Wait Time (Hours)</Label>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-muted-foreground" />
                                                <Input 
                                                    type="number" 
                                                    value={step.delay_hours} 
                                                    onChange={(e) => updateStep(index, 'delay_hours', e.target.value)}
                                                    className="h-8"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Email Template</Label>
                                            <Select 
                                                value={step.template_id} 
                                                onValueChange={(v) => updateStep(index, 'template_id', v)}
                                            >
                                                <SelectTrigger className="h-8">
                                                    <SelectValue placeholder="Select template" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {templates.map(t => (
                                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            
                            {/* Delay Indicator between steps */}
                            {index < steps.length - 1 && (
                                <div className="flex justify-center py-2">
                                    <Badge variant="outline" className="bg-background text-xs">
                                        Wait {steps[index+1].delay_hours} hours
                                    </Badge>
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {steps.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>No steps yet. Add one to start.</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
      </div>
    </div>
  );
}
