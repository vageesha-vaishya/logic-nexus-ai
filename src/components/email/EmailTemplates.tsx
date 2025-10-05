import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Edit, Trash2, Copy, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCRM } from "@/hooks/useCRM";
import { useAuth } from "@/hooks/useAuth";

export function EmailTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [previewing, setPreviewing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const { toast } = useToast();
  const { context, user } = useCRM();
  const { roles } = useAuth();

  const getTenantId = () => {
    if (context?.isPlatformAdmin && selectedTenantId) return selectedTenantId;
    return (
      context?.tenantId ||
      roles?.find((r) => !!r.tenant_id)?.tenant_id ||
      null
    );
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const tenantId = getTenantId();
      if (!tenantId) {
        setTemplates([]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        if (context?.isPlatformAdmin) {
          const { data, error } = await supabase
            .from("tenants")
            .select("id, name")
            .eq("is_active", true)
            .order("name");
          if (error) throw error;
          setTenants(data || []);
          setSelectedTenantId((prev) => prev || (data?.[0]?.id ?? ""));
        } else {
          setSelectedTenantId(
            context?.tenantId || roles?.find((r) => !!r.tenant_id)?.tenant_id || ""
          );
        }
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        fetchTemplates();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantId]);

  const seedTemplates = async () => {
    try {
      const tenantId = getTenantId();
      if (!tenantId) {
        toast({ title: "No tenant selected", description: "Please switch to a tenant or assign a tenant role to seed templates.", variant: "destructive" });
        return;
      }
      const base = {
        tenant_id: tenantId,
        created_by: user?.id || null,
        is_shared: true,
        is_active: true,
      } as any;
      const seeds = [
        {
          name: "Introduction – Discovery Call",
          description: "Warm intro to schedule a discovery call",
          category: "introduction",
          subject: "{{sender_name}} | Quick intro and discovery call?",
          body_html:
            "<p>Hi {{first_name}},</p><p>I’m {{sender_name}} from {{company}}. I’d love to learn more about your goals and see if we can help. Are you available for a quick 15–20 minute discovery call this week?</p><p>Best,<br>{{sender_name}}</p>",
        },
        {
          name: "Follow Up – Checking in",
          description: "Gentle follow up after no response",
          category: "follow_up",
          subject: "Quick follow up on my last note",
          body_html:
            "<p>Hi {{first_name}},</p><p>Just circling back on my previous message. Happy to share more details or tailor a quick overview.</p><p>Would a short call work sometime this week?</p><p>Thanks,<br>{{sender_name}}</p>",
        },
        {
          name: "Meeting – Confirmation",
          description: "Confirm upcoming meeting with agenda",
          category: "meeting",
          subject: "Confirmed: {{meeting_date}} – Agenda inside",
          body_html:
            "<p>Hi {{first_name}},</p><p>Looking forward to our meeting on {{meeting_date}}. Agenda:<br>• Your goals and current process<br>• Solution overview<br>• Next steps</p><p>Feel free to add topics. Talk soon!<br>{{sender_name}}</p>",
        },
        {
          name: "Proposal – Delivery",
          description: "Share proposal and outline next steps",
          category: "proposal",
          subject: "Proposal enclosed – next steps",
          body_html:
            "<p>Hi {{first_name}},</p><p>Attached is the proposal we discussed. It includes scope, timeline, and pricing.</p><p>Shall we review together and finalize the plan?</p><p>Best,<br>{{sender_name}}</p>",
        },
        {
          name: "Thank You – Post Meeting",
          description: "Thanks and recap after a meeting",
          category: "thank_you",
          subject: "Thank you and quick recap",
          body_html:
            "<p>Hi {{first_name}},</p><p>Thanks for your time today. As a recap: {{recap_points}}.</p><p>I’ll follow up with the next steps and materials.</p><p>Best,<br>{{sender_name}}</p>",
        },
      ];
      const { error } = await supabase
        .from("email_templates")
        .insert(
          seeds.map((s) => ({
            ...base,
            ...s,
          }))
        );
      if (error) throw error;
      toast({ title: "Seeded", description: "Best-practice templates added" });
      fetchTemplates();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openCreate = () => {
    setEditing({
      name: "",
      description: "",
      category: "general",
      subject: "",
      body_html: "",
      is_shared: true,
      is_active: true,
    });
    setShowDialog(true);
  };

  const openEdit = (t: any) => {
    setEditing({ ...t });
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!editing?.name || !editing?.subject) {
      toast({ title: "Missing fields", description: "Name and Subject are required.", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const tenantId = getTenantId();
      if (!tenantId) {
        toast({ title: "No tenant selected", description: "Please switch to a tenant or assign a tenant role before saving templates.", variant: "destructive" });
        return;
      }
      const payload = {
        name: editing.name,
        description: editing.description || null,
        category: editing.category || null,
        subject: editing.subject,
        body_html: editing.body_html || null,
        body_text: null,
        is_shared: editing.is_shared ?? true,
        is_active: editing.is_active ?? true,
        tenant_id: tenantId,
        created_by: user?.id || null,
      };
      let resp;
      if (editing.id) {
        resp = await supabase
          .from("email_templates")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editing.id)
          .select("*")
          .single();
      } else {
        resp = await supabase
          .from("email_templates")
          .insert([{ ...payload }])
          .select("*");
      }
      const { error } = resp as any;
      if (error) throw error;
      toast({ title: "Saved", description: "Template saved successfully" });
      closeDialog();
      fetchTemplates();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Template removed" });
      fetchTemplates();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDuplicate = async (t: any) => {
    try {
      const tenantId = getTenantId() || t.tenant_id;
      if (!tenantId) {
        toast({ title: "No tenant selected", description: "Please switch to a tenant or assign a tenant role before duplicating.", variant: "destructive" });
        return;
      }
      const copy = {
        name: `Copy of ${t.name}`,
        description: t.description,
        category: t.category,
        subject: t.subject,
        body_html: t.body_html,
        body_text: t.body_text,
        is_shared: t.is_shared,
        is_active: t.is_active,
        tenant_id: tenantId,
        created_by: user?.id || null,
      };
      const { error } = await supabase.from("email_templates").insert([copy]);
      if (error) throw error;
      toast({ title: "Duplicated", description: "Template copy created" });
      fetchTemplates();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Templates</h2>
          <p className="text-muted-foreground">
            Create reusable email templates for quick responses
          </p>
        </div>
        <div className="flex gap-2 items-end">
          {context?.isPlatformAdmin && (
            <div className="min-w-[240px]">
              <Label>Tenant</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
          <Button variant="outline" onClick={seedTemplates}>
            Seed Best Templates
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading templates...
          </CardContent>
        </Card>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              No email templates created{context?.isPlatformAdmin && !getTenantId() ? 
                ". Choose a tenant to manage templates." : ""}
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Template
              </Button>
              <Button variant="outline" onClick={seedTemplates}>Seed Best Templates</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setPreviewing(template)} title="Preview">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDuplicate(template)} title="Duplicate">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(template)} title="Edit">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {template.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
                    <p className="text-sm font-medium line-clamp-1">{template.subject}</p>
                  </div>
                  {template.category && (
                    <Badge variant="outline">{template.category}</Badge>
                  )}
                  {template.is_shared && (
                    <Badge variant="secondary">Shared</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogDescription>Design reusable email content for your team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={editing?.name || ""} onChange={(e) => setEditing((prev: any) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={editing?.description || ""} onChange={(e) => setEditing((prev: any) => ({ ...prev, description: e.target.value }))} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={editing?.category || "general"} onValueChange={(v) => setEditing((prev: any) => ({ ...prev, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="introduction">Introduction</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="thank_you">Thank You</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject *</Label>
              <Input value={editing?.subject || ""} onChange={(e) => setEditing((prev: any) => ({ ...prev, subject: e.target.value }))} />
            </div>
            <div>
              <Label>Body (HTML supported)</Label>
              <Textarea rows={10} value={editing?.body_html || ""} onChange={(e) => setEditing((prev: any) => ({ ...prev, body_html: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Template"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-2xl">
          {previewing && (
            <>
              <DialogHeader>
                <DialogTitle>{previewing.name}</DialogTitle>
                <DialogDescription>{previewing.subject}</DialogDescription>
              </DialogHeader>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewing.body_html || "<p>(No content)</p>" }} />
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setPreviewing(null)}>Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
