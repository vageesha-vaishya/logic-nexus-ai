import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Loader2, Save, FileText, Plus, GripVertical, Trash2, Eye, Check } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export interface TemplateSection {
  id: string;
  type: 'header' | 'customer_info' | 'transport_details' | 'rate_options' | 'terms' | 'footer' | 'custom_text' | 'shipment_details';
  title: string;
  config: Record<string, any>;
}

const DEFAULT_SECTIONS: TemplateSection[] = [
  { id: 'header', type: 'header', title: 'Header', config: { showLogo: true, showCompanyInfo: true } },
  { id: 'customer', type: 'customer_info', title: 'Customer Information', config: {} },
  { id: 'shipment', type: 'shipment_details', title: 'Shipment Details', config: {} },
  { id: 'transport', type: 'transport_details', title: 'Transport Routing', config: { showLegs: true, legs: [] } },
  { id: 'rates', type: 'rate_options', title: 'Rate Options', config: { showBreakdown: true, options: [] } },
  { id: 'terms', type: 'terms', title: 'Terms & Conditions', config: {} },
  { id: 'footer', type: 'footer', title: 'Footer', config: { text: 'Thank you for your business.' } },
];

function SortableLeg({ leg, index, onUpdate, onRemove }: { leg: any, index: number, onUpdate: (id: string, field: string, value: string) => void, onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: leg.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="grid grid-cols-12 gap-1 items-center bg-white p-1 rounded border mb-1">
      <div {...attributes} {...listeners} className="col-span-1 flex justify-center cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-3 w-3" />
      </div>
      <Input className="col-span-3 h-6 text-[10px] px-1" placeholder="Origin" value={leg.origin} onChange={(e) => onUpdate(leg.id, 'origin', e.target.value)} />
      <Input className="col-span-3 h-6 text-[10px] px-1" placeholder="Dest" value={leg.destination} onChange={(e) => onUpdate(leg.id, 'destination', e.target.value)} />
      <Input className="col-span-2 h-6 text-[10px] px-1" placeholder="Mode" value={leg.mode} onChange={(e) => onUpdate(leg.id, 'mode', e.target.value)} />
      <Input className="col-span-2 h-6 text-[10px] px-1" placeholder="Carrier" value={leg.carrier} onChange={(e) => onUpdate(leg.id, 'carrier', e.target.value)} />
      <Button variant="ghost" size="sm" className="col-span-1 h-6 w-6 p-0 text-destructive" onClick={() => onRemove(leg.id)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

function SortableSection({ section, onRemove, onUpdate }: { section: TemplateSection; onRemove: (id: string) => void; onUpdate: (id: string, updates: Partial<TemplateSection>) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-3">
      <Card className="relative group">
        <CardHeader className="p-3 pb-2 flex flex-row items-center space-y-0 gap-2">
          <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
            <GripVertical className="h-5 w-5" />
          </div>
          <div className="flex-1 font-medium text-sm">
            {section.title} <span className="text-xs text-muted-foreground font-normal ml-2">({section.type})</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(section.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid gap-2">
             <div className="grid grid-cols-3 items-center gap-2">
               <Label className="text-xs">Title</Label>
               <Input 
                 className="col-span-2 h-7 text-xs" 
                 value={section.title} 
                 onChange={(e) => onUpdate(section.id, { title: e.target.value })}
               />
             </div>
             
             {/* Header Config */}
             {section.type === 'header' && (
               <div className="flex items-center gap-2">
                 <Switch 
                   checked={section.config.showLogo} 
                   onCheckedChange={(c) => onUpdate(section.id, { config: { ...section.config, showLogo: c } })}
                 />
                 <Label className="text-xs">Show Logo</Label>
               </div>
             )}

             {/* Footer Config */}
             {section.type === 'footer' && (
                <div className="grid gap-1">
                  <Label className="text-xs">Footer Text</Label>
                  <Input 
                    className="h-7 text-xs" 
                    value={section.config.text || ''} 
                    onChange={(e) => onUpdate(section.id, { config: { ...section.config, text: e.target.value } })}
                  />
                </div>
             )}

             {/* Transport Details Config */}
             {section.type === 'transport_details' && (
               <div className="grid gap-2 mt-2 border-t pt-2">
                 <div className="flex items-center gap-2">
                    <Switch
                      checked={section.config.showLegs}
                      onCheckedChange={(c) => onUpdate(section.id, { config: { ...section.config, showLegs: c } })}
                    />
                    <Label className="text-xs">Show Legs Breakdown</Label>
                 </div>
                 
                 <div className="border rounded p-2 bg-muted/30">
                    <div className="flex justify-between items-center mb-2">
                        <Label className="text-xs font-semibold">Configured Legs</Label>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => {
                            const newLeg = { id: `leg_${Date.now()}`, origin: '', destination: '', mode: 'Ocean', carrier: '' };
                            const legs = section.config.legs || [];
                            onUpdate(section.id, { config: { ...section.config, legs: [...legs, newLeg] } });
                        }}>
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>
                    <div className="space-y-1">
                        {(section.config.legs || []).length === 0 && <p className="text-[10px] text-muted-foreground italic">No specific legs configured.</p>}
                        <SortableContext items={section.config.legs || []} strategy={verticalListSortingStrategy}>
                            {(section.config.legs || []).map((leg: any, idx: number) => (
                                <SortableLeg
                                    key={leg.id}
                                    leg={leg}
                                    index={idx}
                                    onUpdate={(id, field, value) => {
                                        const legs = [...(section.config.legs || [])];
                                        const index = legs.findIndex((l: any) => l.id === id);
                                        if (index !== -1) {
                                            legs[index][field] = value;
                                            onUpdate(section.id, { config: { ...section.config, legs } });
                                        }
                                    }}
                                    onRemove={(id) => {
                                        const legs = (section.config.legs || []).filter((l: any) => l.id !== id);
                                        onUpdate(section.id, { config: { ...section.config, legs } });
                                    }}
                                />
                            ))}
                        </SortableContext>
                    </div>
                 </div>
               </div>
             )}

             {/* Rate Options Config */}
             {section.type === 'rate_options' && (
                <div className="grid gap-2 mt-2 border-t pt-2">
                   <div className="flex items-center gap-2">
                      <Switch
                        checked={section.config.showBreakdown}
                        onCheckedChange={(c) => onUpdate(section.id, { config: { ...section.config, showBreakdown: c } })}
                      />
                      <Label className="text-xs">Show Charge Breakdown</Label>
                   </div>
                   
                   <div className="border rounded p-2 bg-muted/30">
                      <div className="flex justify-between items-center mb-2">
                          <Label className="text-xs font-semibold">Rate Tables</Label>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => {
                              const newOpt = { id: Date.now().toString(), type: 'Spot', name: 'Standard Spot Rate' };
                              const options = section.config.options || [];
                              onUpdate(section.id, { config: { ...section.config, options: [...options, newOpt] } });
                          }}>
                              <Plus className="h-3 w-3" />
                          </Button>
                      </div>
                      <div className="space-y-2">
                          {(section.config.options || []).length === 0 && <p className="text-[10px] text-muted-foreground italic">Default rate tables.</p>}
                          {(section.config.options || []).map((opt: any, idx: number) => (
                              <div key={opt.id} className="grid grid-cols-12 gap-1 items-center">
                                  <span className="col-span-1 text-[10px] text-muted-foreground">{idx + 1}</span>
                                  <Input className="col-span-4 h-6 text-[10px] px-1" placeholder="Type" value={opt.type} onChange={(e) => {
                                      const options = [...(section.config.options || [])];
                                      options[idx].type = e.target.value;
                                      onUpdate(section.id, { config: { ...section.config, options } });
                                  }} />
                                  <Input className="col-span-6 h-6 text-[10px] px-1" placeholder="Display Name" value={opt.name} onChange={(e) => {
                                      const options = [...(section.config.options || [])];
                                      options[idx].name = e.target.value;
                                      onUpdate(section.id, { config: { ...section.config, options } });
                                  }} />
                                  <Button variant="ghost" size="sm" className="col-span-1 h-6 w-6 p-0 text-destructive" onClick={() => {
                                      const options = (section.config.options || []).filter((l: any) => l.id !== opt.id);
                                      onUpdate(section.id, { config: { ...section.config, options } });
                                  }}>
                                      <Trash2 className="h-3 w-3" />
                                  </Button>
                              </div>
                          ))}
                      </div>
                   </div>
                </div>
             )}

             {/* Custom Text Config */}
             {section.type === 'custom_text' && (
                <div className="grid gap-1">
                  <Label className="text-xs">Content</Label>
                  <Input 
                    className="h-7 text-xs" 
                    value={section.config.content || ''} 
                    onChange={(e) => onUpdate(section.id, { config: { ...section.config, content: e.target.value } })}
                    placeholder="Enter custom text..."
                  />
                </div>
             )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function TemplateBuilder() {
  const { supabase, context } = useCRM();
  const navigate = useNavigate();
  const [sections, setSections] = useState<TemplateSection[]>(DEFAULT_SECTIONS);
  const [templateName, setTemplateName] = useState('New Template');
  const [saving, setSaving] = useState(false);
  const [tenantProfile, setTenantProfile] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
  );

  useEffect(() => {
    const loadContextData = async () => {
      if (!context.tenantId) return;

      try {
        // Load Tenant Profile
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenant_profile')
          .select('*')
          .eq('tenant_id', context.tenantId)
          .maybeSingle();
        
        if (tenantData) {
          setTenantProfile(tenantData);
        } else if (tenantError) {
          console.error('Error loading tenant profile:', tenantError);
        } else {
           // Fallback if tenant_profile doesn't exist yet, try tenants table
           const { data: tenantBase } = await supabase
             .from('tenants')
             .select('name')
             .eq('id', context.tenantId)
             .single();
           if (tenantBase) {
             setTenantProfile({ legal_name: tenantBase.name });
           }
        }

        // Load User Profile
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Fetch additional profile data if needed, or just use metadata
          setUserProfile({
            name: user.user_metadata?.full_name || user.email,
            email: user.email
          });
        }
      } catch (err) {
        console.error('Error loading context data:', err);
      }
    };

    loadContextData();
  }, [context.tenantId, supabase]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    // Check if it's a section
    if (sections.find(s => s.id === active.id)) {
      setSections((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        if (newIndex === -1) return items; // Safety check
        return arrayMove(items, oldIndex, newIndex);
      });
      return;
    }

    // Check if it's a leg (assume leg ids start with 'leg_')
    const sectionWithLeg = sections.find(s => s.config.legs?.some((l: any) => l.id === active.id));
    if (sectionWithLeg) {
        const legs = sectionWithLeg.config.legs;
        const oldIndex = legs.findIndex((l: any) => l.id === active.id);
        const newIndex = legs.findIndex((l: any) => l.id === over.id);
        
        if (newIndex !== -1) {
            const newLegs = arrayMove(legs, oldIndex, newIndex);
            handleUpdateSection(sectionWithLeg.id, { config: { ...sectionWithLeg.config, legs: newLegs } });
        }
    }
  };

  const handleRemoveSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  const handleUpdateSection = (id: string, updates: Partial<TemplateSection>) => {
    setSections(sections.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleAddSection = (type: TemplateSection['type']) => {
    const newId = `${type}_${Date.now()}`;
    const newSection: TemplateSection = {
      id: newId,
      type,
      title: type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      config: {
        legs: type === 'transport_details' ? [] : undefined,
        options: type === 'rate_options' ? [] : undefined,
      }
    };
    setSections([...sections, newSection]);
  };

  const handleSave = async (asMglMain: boolean = false) => {
    if (!templateName) {
      toast.error('Template name is required');
      return;
    }
    if (!context.tenantId) {
      toast.error('Tenant context required');
      return;
    }

    setSaving(true);
    try {
      // Extract specialized configs
      const transportSection = sections.find(s => s.type === 'transport_details');
      const rateSection = sections.find(s => s.type === 'rate_options');
      
      const legsConfig = transportSection?.config.legs || [];
      const rateOptions = rateSection?.config.options || [];

      // Validate legs
      for (const leg of legsConfig) {
        if (!leg.origin || !leg.destination || !leg.mode) {
          toast.error('All transport legs must have Origin, Destination, and Mode.');
          setSaving(false);
          return;
        }
      }

      // Also extract simple list of transport modes/carriers if needed for search
      // (Simplified logic here)

      const templateData = {
        name: asMglMain ? 'MGL Main Template' : templateName,
        template_name: asMglMain ? 'MGL-Main-Template' : templateName.replace(/\s+/g, '-').toLowerCase(),
        content: {
          layout: 'enhanced_builder',
          sections: sections
        },
        rate_options: rateOptions,
        transport_modes: [], // Could be derived
        legs_config: legsConfig,
        carrier_selections: [] // Could be derived
      };

      if (asMglMain) {
        // Use the RPC for MGL Main Template
        const { error } = await supabase.rpc('upsert_main_template', {
          p_tenant_id: context.tenantId,
          p_content: templateData.content,
          p_rate_options: templateData.rate_options,
          p_transport_modes: templateData.transport_modes,
          p_legs_config: templateData.legs_config,
          p_carrier_selections: templateData.carrier_selections,
          p_user_id: (await supabase.auth.getUser()).data.user?.id
        });

        if (error) throw error;
        toast.success('Saved as MGL Main Template');
      } else {
        // Standard insert
        const { error } = await supabase.from('quote_templates').insert({
          tenant_id: context.tenantId,
          name: templateData.name,
          template_name: templateData.template_name,
          content: templateData.content,
          rate_options: templateData.rate_options,
          transport_modes: templateData.transport_modes,
          legs_config: templateData.legs_config,
          carrier_selections: templateData.carrier_selections,
        });
        
        if (error) throw error;
        toast.success('Template saved successfully');
      }
    } catch (err: any) {
      console.error('Error saving template:', err);
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-4">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <Input 
            value={templateName} 
            onChange={(e) => setTemplateName(e.target.value)} 
            className="w-[300px] text-lg font-medium"
            placeholder="Template Name"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            <Check className="mr-2 h-4 w-4" />
            Save as MGL-Main-Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 h-full overflow-hidden">
        {/* Sidebar Controls */}
        <div className="col-span-3 border-r pr-4 flex flex-col gap-4 overflow-y-auto">
          <h3 className="font-semibold mb-2">Structure</h3>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections} strategy={verticalListSortingStrategy}>
              {sections.map((section) => (
                <SortableSection 
                  key={section.id} 
                  section={section} 
                  onRemove={handleRemoveSection} 
                  onUpdate={handleUpdateSection} 
                />
              ))}
            </SortableContext>
          </DndContext>

          <Separator />
          
          <h3 className="font-semibold mb-2">Add Section</h3>
          <div className="grid grid-cols-1 gap-2">
             <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddSection('custom_text')}>
                <Plus className="mr-2 h-3 w-3" /> Custom Text Block
             </Button>
             <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddSection('rate_options')}>
                <Plus className="mr-2 h-3 w-3" /> Rate Options Table
             </Button>
             <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddSection('transport_details')}>
                <Plus className="mr-2 h-3 w-3" /> Transport Details
             </Button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="col-span-9 bg-muted/20 rounded-lg p-8 overflow-y-auto">
          <div className="bg-white shadow-lg min-h-[800px] w-full max-w-[800px] mx-auto p-8 flex flex-col gap-4">
            {sections.map((section) => (
              <div key={section.id} className="border border-transparent hover:border-dashed hover:border-primary/50 p-2 rounded transition-colors">
                {section.type === 'header' && (
                  <div className="flex justify-between items-start border-b pb-4 mb-4">
                    {section.config.showLogo && (
                      <div className="w-32 h-12 bg-gray-200 flex items-center justify-center text-xs text-muted-foreground overflow-hidden">
                        {tenantProfile?.logo_url ? (
                          <img src={tenantProfile.logo_url} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                          <span className="p-1 text-center">{tenantProfile?.legal_name || 'Tenant Logo'}</span>
                        )}
                      </div>
                    )}
                    <div className="text-right">
                      <h1 className="text-2xl font-bold text-primary">QUOTATION</h1>
                      <div className="text-sm text-muted-foreground mt-2">
                        <p>#QUO-2026-001</p>
                        <p>Date: {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {section.type === 'customer_info' && (
                  <div className="grid grid-cols-2 gap-8 mb-6">
                    <div>
                       <h3 className="font-bold text-sm mb-2 text-gray-700">PREPARED FOR:</h3>
                       <div className="text-sm space-y-1 text-gray-600">
                         <p className="font-medium">Acme Corp International</p>
                         <p>123 Business Park</p>
                         <p>New York, NY 10001</p>
                         <p>Attn: John Doe</p>
                       </div>
                    </div>
                    <div>
                       <h3 className="font-bold text-sm mb-2 text-gray-700">PREPARED BY:</h3>
                       <div className="text-sm space-y-1 text-gray-600">
                         <p className="font-medium">{userProfile?.name || 'Sales Rep Name'}</p>
                         <p>{userProfile?.email || 'sales@example.com'}</p>
                         {tenantProfile?.contact_phone && <p>{tenantProfile.contact_phone}</p>}
                         {tenantProfile?.website && <p>{tenantProfile.website}</p>}
                       </div>
                    </div>
                  </div>
                )}

                {section.type === 'transport_details' && (
                  <div className="mb-6">
                    <h3 className="font-bold text-sm mb-2 border-b pb-1 text-gray-700 uppercase">{section.title}</h3>
                    {/* Render configured legs if any, else default */}
                    {(section.config.legs && section.config.legs.length > 0) ? (
                        <div className="bg-gray-50 p-4 rounded text-sm grid grid-cols-1 gap-2">
                            {section.config.legs.map((leg: any, i: number) => (
                                <div key={i} className="grid grid-cols-4 gap-4 border-b last:border-0 pb-2 last:pb-0">
                                   <div><span className="text-xs text-muted-foreground block">Origin</span>{leg.origin || '...'}</div>
                                   <div><span className="text-xs text-muted-foreground block">Dest</span>{leg.destination || '...'}</div>
                                   <div><span className="text-xs text-muted-foreground block">Mode</span>{leg.mode || '...'}</div>
                                   <div><span className="text-xs text-muted-foreground block">Carrier</span>{leg.carrier || '...'}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-gray-50 p-4 rounded text-sm grid grid-cols-4 gap-4">
                           <div>
                             <span className="block text-xs text-muted-foreground uppercase">Origin</span>
                             <span className="font-medium">Shanghai, CN</span>
                           </div>
                           <div>
                             <span className="block text-xs text-muted-foreground uppercase">Destination</span>
                             <span className="font-medium">Hamburg, DE</span>
                           </div>
                           <div>
                             <span className="block text-xs text-muted-foreground uppercase">Mode</span>
                             <span className="font-medium">Ocean FCL</span>
                           </div>
                           <div>
                             <span className="block text-xs text-muted-foreground uppercase">Transit Time</span>
                             <span className="font-medium">35 Days</span>
                           </div>
                        </div>
                    )}
                  </div>
                )}

                {section.type === 'rate_options' && (
                  <div className="mb-6">
                    <h3 className="font-bold text-sm mb-2 border-b pb-1 text-gray-700 uppercase">{section.title}</h3>
                    {(section.config.options && section.config.options.length > 0) ? (
                        <div className="space-y-4">
                            {section.config.options.map((opt: any, i: number) => (
                                <div key={i}>
                                    <h4 className="text-xs font-bold text-gray-600 mb-1">{opt.name} ({opt.type})</h4>
                                    <table className="w-full text-sm">
                                      <thead><tr className="bg-gray-100"><th className="text-left p-2">Item</th><th className="text-right p-2">Total</th></tr></thead>
                                      <tbody><tr><td className="p-2">Freight & Charges</td><td className="text-right p-2">$0.00</td></tr></tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="text-left p-2">Description</th>
                              <th className="text-right p-2">Qty</th>
                              <th className="text-right p-2">Unit Price</th>
                              <th className="text-right p-2">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2">Ocean Freight (40HC)</td>
                              <td className="text-right p-2">1</td>
                              <td className="text-right p-2">$2,500.00</td>
                              <td className="text-right p-2">$2,500.00</td>
                            </tr>
                            <tr>
                              <td className="p-2">Terminal Handling</td>
                              <td className="text-right p-2">1</td>
                              <td className="text-right p-2">$350.00</td>
                              <td className="text-right p-2">$350.00</td>
                            </tr>
                          </tbody>
                        </table>
                    )}
                  </div>
                )}

                {section.type === 'terms' && (
                  <div className="mb-6">
                     <h3 className="font-bold text-sm mb-2 text-gray-700 uppercase">{section.title}</h3>
                     <ul className="list-disc pl-4 text-xs text-gray-600 space-y-1">
                        <li>This quote is valid for 30 days.</li>
                        <li>Subject to equipment availability.</li>
                        <li>General Terms and Conditions apply.</li>
                     </ul>
                  </div>
                )}

                {section.type === 'footer' && (
                  <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
                    <p>{section.config.text}</p>
                    <p className="mt-1">Registered Office: {tenantProfile?.address || '123 Logistics Way, Suite 100, Miami, FL 33132'}</p>
                    {tenantProfile?.tax_id && <p>Tax ID: {tenantProfile.tax_id}</p>}
                  </div>
                )}

                {section.type === 'custom_text' && (
                   <div className="mb-4 text-sm text-gray-600 italic border p-4 border-dashed rounded bg-gray-50/50">
                      {section.config.content || '[Custom Text Block Placeholder]'}
                   </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
