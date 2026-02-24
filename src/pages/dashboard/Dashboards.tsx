import { useState, useEffect, useCallback } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Plus, Layout, Save, X, GripVertical, Users, Eye } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { WidgetConfig, WidgetType, WidgetSize } from '@/types/dashboard';
import { AVAILABLE_WIDGETS, getWidgetDefinition } from '@/config/widgets';
import { DraggableWidget } from '@/components/dashboard/DraggableWidget';
import { WidgetSettingsDialog } from '@/components/dashboard/WidgetSettingsDialog';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useCRM } from '@/hooks/useCRM';
import { DashboardService } from '@/lib/dashboard-service';
import { useToast } from '@/components/ui/use-toast';
import { WidgetSkeleton } from '@/components/dashboard/widgets/WidgetSkeleton';

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'stats-1', type: 'stats', title: 'KPIs', size: 'full', order: 0 },
  { id: 'financial-1', type: 'financial', title: 'Financial Performance', size: 'large', order: 1 },
  { id: 'volume-1', type: 'volume', title: 'Shipment Volume', size: 'medium', order: 2 },
  { id: 'leads-1', type: 'leads', title: 'My Leads', size: 'medium', order: 3 },
  { id: 'activities-1', type: 'activities', title: 'My Activities', size: 'medium', order: 4 },
];

export default function Dashboards() {
  const { t } = useTranslation();
  const { error } = useDashboardData(); // Still check for data errors
  const { scopedDb, user } = useCRM();
  const { toast } = useToast();

  // State
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Team View State
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // New Widget Form State
  const [newWidgetType, setNewWidgetType] = useState<WidgetType>('accounts');
  const [newWidgetTitle, setNewWidgetTitle] = useState('');
  const [newWidgetSize, setNewWidgetSize] = useState<WidgetSize>('medium');

  const isOwnDashboard = !viewingUserId || viewingUserId === user?.id;

  // Load Team Members
  useEffect(() => {
    const loadTeam = async () => {
      try {
        const members = await DashboardService.getTeamMembers(scopedDb);
        setTeamMembers(members || []);
      } catch (err) {
        console.error('Failed to load team members:', err);
      }
    };
    loadTeam();
  }, [scopedDb]);

  // Load Widgets
  useEffect(() => {
    const loadWidgets = async () => {
      if (!user) return;
      
      const targetUserId = viewingUserId || user.id;
      setIsLoading(true);
      
      try {
        const savedWidgets = await DashboardService.getPreferences(scopedDb, targetUserId);
        if (savedWidgets && savedWidgets.length > 0) {
          setWidgets(savedWidgets);
        } else {
          // Fallback to local storage only for own dashboard if DB is empty (migration path)
          // Or just default. Let's try localStorage if it's own dashboard.
          if (targetUserId === user.id) {
             const local = localStorage.getItem('dashboard_widgets');
             if (local) {
               setWidgets(JSON.parse(local));
             } else {
               setWidgets(DEFAULT_WIDGETS);
             }
          } else {
            setWidgets(DEFAULT_WIDGETS);
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard preferences:', err);
        toast({
          title: t('Error'),
          description: t('Failed to load dashboard preferences') + (err instanceof Error ? ': ' + err.message : ''),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadWidgets();
  }, [user, viewingUserId, scopedDb, toast, t]);

  // Save Widgets (Debounced or on change)
  useEffect(() => {
    if (!isOwnDashboard || isLoading) return;

    // Save to local storage as backup/immediate sync
    localStorage.setItem('dashboard_widgets', JSON.stringify(widgets));

    // Save to DB
    const saveToDb = async () => {
      try {
        await DashboardService.savePreferences(scopedDb, widgets);
      } catch (err) {
        console.error('Failed to save dashboard preferences:', err);
      }
    };

    // Debounce saving to DB
    const timeout = setTimeout(saveToDb, 1000);
    return () => clearTimeout(timeout);
  }, [widgets, isOwnDashboard, isLoading, scopedDb]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        // Update order property
        return newItems.map((item, index) => ({ ...item, order: index }));
      });
    }
    setActiveId(null);
  };

  const handleAddWidget = () => {
    const def = getWidgetDefinition(newWidgetType);
    if (!def) return;

    const newWidget: WidgetConfig = {
      id: `${newWidgetType}-${Date.now()}`,
      type: newWidgetType,
      title: newWidgetTitle || def.label,
      size: newWidgetSize,
      order: widgets.length,
    };

    setWidgets([...widgets, newWidget]);
    setIsAddDialogOpen(false);
    setNewWidgetTitle('');
    setNewWidgetSize('medium');
    setIsEditMode(true); // Switch to edit mode to allow immediate positioning
  };

  const handleRemoveWidget = (id: string) => {
    if (confirm(t('Are you sure you want to remove this widget?'))) {
      setWidgets(widgets.filter((w) => w.id !== id));
    }
  };

  const handleEditWidget = (id: string, newConfig: Partial<WidgetConfig>) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, ...newConfig } : w));
  };

  const handleOpenSettings = (id: string) => {
    const widget = widgets.find(w => w.id === id);
    if (widget) {
      setEditingWidget(widget);
    }
  };

  const activeWidget = activeId ? widgets.find(w => w.id === activeId) : null;

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('Error')}</AlertTitle>
            <AlertDescription>
              {t('Failed to load dashboard data. Please try refreshing the page.')}
              <br />
              <span className="text-xs opacity-70">{error.message}</span>
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('Dashboards')}</h1>
            <p className="text-muted-foreground">{t('Your work at a glance')}</p>
          </div>
          <div className="flex gap-2 items-center">
            {/* Team View Selector */}
            {teamMembers.length > 0 && (
              <Select value={viewingUserId || 'me'} onValueChange={(v) => setViewingUserId(v === 'me' ? null : v)}>
                <SelectTrigger className="w-[200px]">
                  <Users className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={t("View Team Member")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">{t("My Dashboard")}</SelectItem>
                  {teamMembers
                    .filter(m => m.id !== user?.id)
                    .map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback>{member.first_name?.[0]}{member.last_name?.[0]}</AvatarFallback>
                          </Avatar>
                          {member.first_name} {member.last_name}
                        </div>
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {isEditMode ? (
              <>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      {t('Add Widget')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('Add New Widget')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>{t('Widget Type')}</Label>
                        <Select 
                          value={newWidgetType} 
                          onValueChange={(v) => {
                            setNewWidgetType(v as WidgetType);
                            const def = getWidgetDefinition(v);
                            if (def) setNewWidgetSize(def.defaultSize);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_WIDGETS.map((w) => (
                              <SelectItem key={w.type} value={w.type}>
                                {w.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          {getWidgetDefinition(newWidgetType)?.description}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('Title (Optional)')}</Label>
                        <Input 
                          placeholder={getWidgetDefinition(newWidgetType)?.label} 
                          value={newWidgetTitle}
                          onChange={(e) => setNewWidgetTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('Size')}</Label>
                        <Select value={newWidgetSize} onValueChange={(v) => setNewWidgetSize(v as WidgetSize)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">{t('Small (1/4)')}</SelectItem>
                            <SelectItem value="medium">{t('Medium (1/2)')}</SelectItem>
                            <SelectItem value="large">{t('Large (3/4)')}</SelectItem>
                            <SelectItem value="full">{t('Full Width')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleAddWidget} className="w-full">
                        {t('Add Widget')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Button variant="default" size="sm" onClick={() => setIsEditMode(false)}>
                  <Save className="mr-2 h-4 w-4" />
                  {t('Done')}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                <Layout className="mr-2 h-4 w-4" />
                {t('Customize')}
              </Button>
            )}
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={widgets} strategy={rectSortingStrategy}>
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-min ${!isOwnDashboard ? 'pointer-events-none' : ''}`}>
              {isLoading ? (
                // Show skeletons for the default layout while loading
                DEFAULT_WIDGETS.map((w, i) => (
                  <div key={`skeleton-${i}`} className={cn(
                    "h-full",
                    {
                      small: 'col-span-1',
                      medium: 'col-span-1 md:col-span-2 lg:col-span-1', 
                      large: 'col-span-1 md:col-span-2 lg:col-span-2',
                      full: 'col-span-1 md:col-span-2 lg:col-span-4',
                    }[w.size]
                  )}>
                    <WidgetSkeleton />
                  </div>
                ))
              ) : (
                widgets.map((widget) => (
                  <DraggableWidget
                    key={widget.id}
                    config={widget}
                    onRemove={handleRemoveWidget}
                    onEdit={handleEditWidget}
                    onSettings={handleOpenSettings}
                    isEditMode={isEditMode && isOwnDashboard}
                  />
                ))
              )}
            </div>
          </SortableContext>
          
          <DragOverlay
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: '0.5',
                  },
                },
              }),
            }}
          >
            {activeWidget ? (
              <DraggableWidget
                config={activeWidget}
                onRemove={handleRemoveWidget}
                onEdit={handleEditWidget}
                onSettings={handleOpenSettings}
                isEditMode={true}
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        <WidgetSettingsDialog 
          open={!!editingWidget} 
          onOpenChange={(open) => !open && setEditingWidget(null)} 
          config={editingWidget}
          onSave={handleEditWidget}
        />
      </div>
    </DashboardLayout>
  );
}
