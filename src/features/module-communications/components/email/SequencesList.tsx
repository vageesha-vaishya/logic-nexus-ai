
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, Edit, MoreVertical, Users, Clock, CheckCircle } from "lucide-react";
import { useCRM } from "@/hooks/useCRM";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SequenceEditor } from "./SequenceEditor";

export function SequencesList() {
  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSequence, setEditingSequence] = useState<any | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const { scopedDb, context } = useCRM();
  const { toast } = useToast();

  const fetchSequences = async () => {
    try {
      setLoading(true);
      if (!context?.tenantId) return;

      const { data, error } = await scopedDb
        .from("email_sequences")
        .select(`
          *,
          enrollments:email_sequence_enrollments(count),
          steps:email_sequence_steps(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSequences(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching sequences",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSequences();
  }, [context?.tenantId]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const { error } = await scopedDb
        .from("email_sequences")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      
      setSequences(sequences.map(s => 
        s.id === id ? { ...s, status: newStatus } : s
      ));
      
      toast({
        title: "Status Updated",
        description: `Sequence is now ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">Email Sequences</h2>
            <p className="text-muted-foreground">Automate your outreach with multi-step drip campaigns.</p>
        </div>
        <Button onClick={() => { setEditingSequence(null); setIsEditorOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Sequence
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sequences.map((seq) => (
          <Card key={seq.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">
                  {seq.name}
                </CardTitle>
                <CardDescription className="line-clamp-1">
                  {seq.description || "No description"}
                </CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditingSequence(seq); setIsEditorOpen(true); }}>
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleStatus(seq.id, seq.status)}>
                    {seq.status === 'active' ? (
                      <><Pause className="w-4 h-4 mr-2" /> Pause</>
                    ) : (
                      <><Play className="w-4 h-4 mr-2" /> Activate</>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                 <Badge variant={seq.status === 'active' ? 'default' : 'secondary'}>
                    {seq.status}
                 </Badge>
                 <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {seq.steps?.[0]?.count || 0} Steps
                 </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
                <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs">Enrolled</span>
                    <span className="font-medium flex items-center gap-1">
                        <Users className="w-3 h-3" /> {seq.enrollments?.[0]?.count || 0}
                    </span>
                </div>
                {/* Future: Add Open/Reply Rate stats here */}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {sequences.length === 0 && !loading && (
             <div className="col-span-full text-center py-12 border rounded-lg border-dashed text-muted-foreground">
                <p>No sequences found. Create your first drip campaign.</p>
             </div>
        )}
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
             {isEditorOpen && (
                 <SequenceEditor 
                    sequenceId={editingSequence?.id} 
                    onClose={() => { setIsEditorOpen(false); fetchSequences(); }} 
                 />
             )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
