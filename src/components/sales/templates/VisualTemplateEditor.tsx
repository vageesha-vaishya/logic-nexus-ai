import React, { useState } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent 
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, GripVertical, Plus, AlertTriangle, FileCode, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VisualTemplatePreview } from './VisualTemplatePreview';
import { TemplateLibraryModal } from './TemplateLibraryModal';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface TemplateSection {
  id: string; // Added ID for dnd-kit
  type: string;
  title?: string;
  content?: any;
  table_config?: any;
  [key: string]: any;
}

interface VisualTemplateEditorProps {
  value: any; // The JSON content
  onChange: (value: any) => void;
}

const SECTION_TYPES = [
  { value: 'header', label: 'Header' },
  { value: 'footer', label: 'Footer' },
  { value: 'static_block', label: 'Static Text Block' },
  { value: 'dynamic_table', label: 'Dynamic Table' },
  { value: 'customer_matrix_header', label: 'Customer Matrix (MGL)' },
  { value: 'shipment_matrix_details', label: 'Shipment Details (MGL)' },
  { value: 'rates_matrix', label: 'Rates Matrix (MGL)' },
  { value: 'terms', label: 'Terms & Conditions' },
];

// --- Sortable Item Component ---
function SortableItem({ section, index, updateSection, removeSection }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-3">
      <Card className="relative group hover:border-primary/50 transition-colors">
        <CardHeader className="p-3 pb-2 flex flex-row items-center space-y-0 gap-2">
          <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
            <GripVertical className="h-5 w-5" />
          </div>
          <div className="flex-1 font-medium text-sm truncate">
            {section.title || `Section ${index + 1}`} <span className="text-xs text-muted-foreground font-normal ml-2">({section.type})</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => removeSection(section.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-3 pt-0 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Type</Label>
                <Select
                  value={section.type}
                  onValueChange={(val) => updateSection(section.id, 'type', val)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>
             <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Title</Label>
                <Input
                  className="h-7 text-xs"
                  value={section.title || ''}
                  onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                  placeholder="Section Title"
                />
             </div>
          </div>
          
          {/* Content Editor based on Type */}
          {(section.type === 'static_block' || section.type === 'header' || section.type === 'footer') && (
             <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Content Text</Label>
                <Textarea 
                   className="h-16 text-xs font-mono"
                   value={section.content?.text || ''}
                   onChange={(e) => updateSection(section.id, 'content', { ...section.content, text: e.target.value })}
                   placeholder="Enter text content..."
                />
             </div>
          )}

           {/* Validation Error Indicator */}
           {(!section.type) && (
              <div className="text-xs text-destructive flex items-center gap-1">
                 <AlertTriangle className="h-3 w-3" /> Type is required
              </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Main Component ---
export function VisualTemplateEditor({ value, onChange }: VisualTemplateEditorProps) {
  const [activeTab, setActiveTab] = useState('design');
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [legacyJson, setLegacyJson] = useState('');

  // Ensure sections have IDs for dnd-kit
  const safeValue = typeof value === 'object' && value !== null ? value : {};
  const sections = Array.isArray(safeValue.sections) 
    ? safeValue.sections.map((s: any) => ({ ...s, id: s.id || crypto.randomUUID() })) 
    : [];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = sections.findIndex((s: any) => s.id === active.id);
      const newIndex = sections.findIndex((s: any) => s.id === over?.id);
      
      const newSections = arrayMove(sections, oldIndex, newIndex);
      onChange({ ...safeValue, sections: newSections });
    }
  };

  const addSection = () => {
    const newSection: TemplateSection = {
      id: crypto.randomUUID(),
      type: 'static_block',
      title: 'New Section',
      content: { text: '' },
    };
    onChange({ ...safeValue, sections: [...sections, newSection] });
  };

  const removeSection = (id: string) => {
    const newSections = sections.filter((s: any) => s.id !== id);
    onChange({ ...safeValue, sections: newSections });
  };

  const updateSection = (id: string, field: string, fieldValue: any) => {
    const newSections = sections.map((s: any) => {
      if (s.id === id) {
        return { ...s, [field]: fieldValue };
      }
      return s;
    });
    onChange({ ...safeValue, sections: newSections });
  };

  const handleMigration = () => {
      try {
          const legacy = JSON.parse(legacyJson);
          // Simple migration logic: if it has 'items' array, map to dynamic_table
          const newSections = [...sections];
          
          if (legacy.headerText) {
              newSections.push({ id: crypto.randomUUID(), type: 'header', content: { text: legacy.headerText } });
          }
          
          if (Array.isArray(legacy.items)) {
              newSections.push({
                  id: crypto.randomUUID(),
                  type: 'dynamic_table',
                  title: 'Legacy Items',
                  table_config: {
                      source: 'items',
                      columns: [
                          { field: 'description', label: 'Description', width: '50%' },
                          { field: 'amount', label: 'Amount', width: '20%', format: 'currency' }
                      ]
                  }
              });
          }

          if (legacy.footerText) {
              newSections.push({ id: crypto.randomUUID(), type: 'footer', content: { text: legacy.footerText } });
          }

          onChange({ ...safeValue, sections: newSections });
          setMigrationOpen(false);
          toast.success("Legacy template migrated successfully!");
      } catch (e) {
          toast.error("Invalid JSON format");
      }
  };

  const handleLibrarySelect = (templateContent: any) => {
      // Ensure IDs
      const newSections = templateContent.sections.map((s: any) => ({ ...s, id: crypto.randomUUID() }));
      onChange({ 
          ...safeValue, 
          ...templateContent,
          sections: newSections 
      });
      toast.success("Template loaded from library");
  };

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
            <TemplateLibraryModal onSelect={handleLibrarySelect} />
            
            <Dialog open={migrationOpen} onOpenChange={setMigrationOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                        <FileCode className="h-4 w-4" /> Import Legacy
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Migrate Legacy Template</DialogTitle>
                        <DialogDescription>Paste your old JSON configuration here.</DialogDescription>
                    </DialogHeader>
                    <Textarea 
                        value={legacyJson} 
                        onChange={(e) => setLegacyJson(e.target.value)} 
                        className="h-[300px] font-mono text-xs"
                        placeholder='{"headerText": "...", "items": []}'
                    />
                    <Button onClick={handleMigration}>Migrate</Button>
                </DialogContent>
            </Dialog>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Auto-saved
           </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
        {/* Left: Editor Panel */}
        <div className="flex flex-col min-h-0 border rounded-lg bg-background shadow-sm">
           <div className="p-3 border-b bg-muted/20 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Structure</h3>
              <Button onClick={addSection} size="sm" className="h-7 gap-1">
                 <Plus className="h-3 w-3" /> Section
              </Button>
           </div>
           <ScrollArea className="flex-1 p-3">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={sections.map((s: any) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sections.map((section: any, index: number) => (
                    <SortableItem 
                       key={section.id} 
                       section={section} 
                       index={index} 
                       updateSection={updateSection} 
                       removeSection={removeSection} 
                    />
                  ))}
                  {sections.length === 0 && (
                     <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        Drag & Drop Designer<br/>
                        <span className="text-xs">Add a section to start building</span>
                     </div>
                  )}
                </SortableContext>
              </DndContext>
           </ScrollArea>
        </div>

        {/* Right: Preview Panel */}
        <div className="flex flex-col min-h-0 border rounded-lg overflow-hidden bg-muted/10">
           <div className="p-3 border-b bg-muted/20">
              <h3 className="font-semibold text-sm">Real-time Preview</h3>
           </div>
           <div className="flex-1 p-4 overflow-hidden">
               <VisualTemplatePreview template={{ ...safeValue, sections }} className="h-full" />
           </div>
        </div>
      </div>
    </div>
  );
}
