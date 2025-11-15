import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Filter, Layers, Settings, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Droppable } from "@/components/kanban/Droppable";
import { Draggable } from "@/components/kanban/Draggable";
import { SwimLane } from "@/components/kanban/SwimLane";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type ContactStage = 'new_contact' | 'verified' | 'key_decision_maker' | 'active' | 'inactive' | 'bounced_invalid';

interface Contact {
  id: string;
  account_id: string | null;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean | null;
  created_at: string;
}

interface Activity {
  id: string;
  contact_id: string | null;
  created_at: string;
}

const stageLabels: Record<ContactStage, string> = {
  new_contact: '🆕 New Contact',
  verified: '✅ Verified',
  key_decision_maker: '🌟 Key Decision Maker',
  active: '📊 Active',
  inactive: '🛌 Inactive',
  bounced_invalid: '❌ Bounced/Invalid',
};

const stageColors: Record<ContactStage, string> = {
  new_contact: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  verified: 'bg-green-500/10 text-green-700 dark:text-green-300',
  key_decision_maker: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  active: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  inactive: 'bg-gray-500/10 text-gray-700 dark:text-gray-300',
  bounced_invalid: 'bg-red-500/10 text-red-700 dark:text-red-300',
};

const stages: ContactStage[] = ['new_contact','verified','key_decision_maker','active','inactive','bounced_invalid'];

export default function ContactsPipeline() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupBy, setGroupBy] = useState<'none' | 'account'>('none');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [wipLimits, setWipLimits] = useState<Record<ContactStage, number>>({
    new_contact: 999, verified: 999, key_decision_maker: 999, active: 999, inactive: 999, bounced_invalid: 999,
  });
  const [showFields, setShowFields] = useState({ email: true, phone: true, title: true });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: c, error: ce } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
      if (ce) throw ce;
      setContacts((c || []) as Contact[]);
      const { data: a, error: ae } = await supabase.from('activities').select('id, contact_id, created_at').order('created_at', { ascending: false }).limit(1000);
      if (ae) throw ae;
      setActivities((a || []) as Activity[]);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch contacts', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const latestActivityByContact = useMemo(() => {
    const m: Record<string, number> = {};
    for (const act of activities) {
      if (!act.contact_id) continue;
      const ts = new Date(act.created_at).getTime();
      if (!m[act.contact_id] || ts > m[act.contact_id]) m[act.contact_id] = ts;
    }
    return m;
  }, [activities]);

  const computeStage = (c: Contact): ContactStage => {
    const createdTs = new Date(c.created_at).getTime();
    const daysSinceCreate = (Date.now() - createdTs) / (1000 * 60 * 60 * 24);
    const hasEmail = !!c.email && c.email.includes('@');
    const hasPhone = !!c.phone && c.phone.length > 0;
    const title = (c.title || '').toLowerCase();
    const lastActTs = latestActivityByContact[c.id];
    const daysSinceAct = lastActTs ? (Date.now() - lastActTs) / (1000 * 60 * 60 * 24) : Infinity;
    if (hasEmail && c.email!.toLowerCase().includes('bounce')) return 'bounced_invalid';
    if (title.includes('director') || title.includes('vp') || title.includes('head') || title.includes('owner') || title.includes('manager') || c.is_primary) return 'key_decision_maker';
    if (hasEmail && hasPhone) return 'verified';
    if (daysSinceAct <= 30) return 'active';
    if (daysSinceCreate <= 30) return 'new_contact';
    return 'inactive';
  };

  const filtered = contacts.filter((c) => {
    const s = searchQuery.toLowerCase();
    return !searchQuery || `${c.first_name} ${c.last_name}`.toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s);
  });

  const grouped: Record<ContactStage, Contact[]> = stages.reduce((acc, stage) => {
    acc[stage] = filtered.filter((c) => computeStage(c) === stage);
    return acc;
  }, {} as Record<ContactStage, Contact[]>);

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const handleDragEnd = (e: DragEndEvent) => setActiveId(null);

  const activeContact = activeId ? contacts.find(c => c.id === activeId) : null;

  const getSwimLanes = () => {
    if (groupBy === 'none') return [{ id: 'all', title: 'All Contacts', items: filtered }];
    const accounts = new Map<string, Contact[]>();
    for (const c of filtered) {
      const key = c.account_id || 'unassigned';
      if (!accounts.has(key)) accounts.set(key, []);
      accounts.get(key)!.push(c);
    }
    return Array.from(accounts.entries()).map(([id, items]) => ({ id, title: id === 'unassigned' ? 'Unassigned' : `Account ${id.slice(0,8)}`, items }));
  };

  const lanes = getSwimLanes();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contacts Pipeline</h1>
            <p className="text-muted-foreground">Engagement lifecycle for contacts</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/contacts')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search contacts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <Layers className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Group By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="account">By Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Customize Cards
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">Loading contacts...</div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="space-y-4">
              {lanes.map(lane => {
                const laneGrouped = stages.reduce((acc, stage) => {
                  acc[stage] = lane.items.filter(c => computeStage(c) === stage);
                  return acc;
                }, {} as Record<ContactStage, Contact[]>);

                return (
                  <SwimLane key={lane.id} id={lane.id} title={lane.title} count={lane.items.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                      {stages.map((stage) => (
                        <Droppable key={stage} id={stage}>
                          <Card className="h-full transition-all duration-200 hover:shadow-md">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium flex items-center justify-between">
                                <span>{stageLabels[stage]}</span>
                                <Badge variant="secondary" className={`${stageColors[stage]} transition-all duration-200`}>{laneGrouped[stage].length}</Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 min-h-[200px]">
                              {laneGrouped[stage].map((c) => (
                                <Draggable key={c.id} id={c.id}>
                                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 animate-fade-in" onClick={() => navigate(`/dashboard/contacts/${c.id}`)}>
                                    <CardContent className="p-3 space-y-2">
                                      <div className="font-medium text-sm">{c.first_name} {c.last_name}</div>
                                      {showFields.title && c.title && (<div className="text-xs text-muted-foreground">{c.title}</div>)}
                                      {showFields.email && c.email && (<div className="text-xs text-muted-foreground">{c.email}</div>)}
                                      {showFields.phone && c.phone && (<div className="text-xs text-muted-foreground">{c.phone}</div>)}
                                    </CardContent>
                                  </Card>
                                </Draggable>
                              ))}
                              {laneGrouped[stage].length === 0 && (
                                <div className="text-xs text-muted-foreground text-center py-4">No contacts in this stage</div>
                              )}
                            </CardContent>
                          </Card>
                        </Droppable>
                      ))}
                    </div>
                  </SwimLane>
                );
              })}
            </div>
            <DragOverlay>
              {activeContact ? (
                <Card className="w-64 shadow-2xl rotate-3 scale-105 border-2 border-primary animate-scale-in">
                  <CardContent className="p-3 space-y-2 bg-gradient-to-br from-background to-muted">
                    <div className="font-medium text-sm">{activeContact.first_name} {activeContact.last_name}</div>
                    {activeContact.title && (<div className="text-xs text-muted-foreground">{activeContact.title}</div>)}
                  </CardContent>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </DashboardLayout>
  );
}