import { useState, useEffect } from 'react';
import { TransferService, TransferEntityType, TransferableEntity } from '@/lib/transfer-service';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, Package, Users, FileText, Truck, Building2, User, Activity } from 'lucide-react';

interface EntitySelectorProps {
  tenantId: string;
  franchiseId?: string;
  selectedEntities: { type: TransferEntityType; id: string; name: string }[];
  onSelectionChange: (entities: { type: TransferEntityType; id: string; name: string }[]) => void;
}

const entityTypeConfig: { type: TransferEntityType; label: string; icon: React.ComponentType<any> }[] = [
  { type: 'lead', label: 'Leads', icon: Users },
  { type: 'opportunity', label: 'Opportunities', icon: Package },
  { type: 'quote', label: 'Quotes', icon: FileText },
  { type: 'shipment', label: 'Shipments', icon: Truck },
  { type: 'account', label: 'Accounts', icon: Building2 },
  { type: 'contact', label: 'Contacts', icon: User },
  { type: 'activity', label: 'Activities', icon: Activity },
];

export function EntitySelector({
  tenantId,
  franchiseId,
  selectedEntities,
  onSelectionChange,
}: EntitySelectorProps) {
  const [activeTab, setActiveTab] = useState<TransferEntityType>('lead');
  const [search, setSearch] = useState('');
  const [entities, setEntities] = useState<TransferableEntity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadEntities = async () => {
      if (!tenantId) return;
      setLoading(true);
      try {
        const data = await TransferService.getTransferableEntities(
          activeTab,
          tenantId,
          franchiseId,
          search || undefined
        );
        setEntities(data);
      } catch (error) {
        console.error('Error loading entities:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(loadEntities, 300);
    return () => clearTimeout(debounce);
  }, [activeTab, tenantId, franchiseId, search]);

  const isSelected = (entityId: string) => 
    selectedEntities.some(e => e.id === entityId);

  const toggleEntity = (entity: TransferableEntity) => {
    if (isSelected(entity.id)) {
      onSelectionChange(selectedEntities.filter(e => e.id !== entity.id));
    } else {
      onSelectionChange([...selectedEntities, { 
        type: entity.type, 
        id: entity.id, 
        name: entity.name 
      }]);
    }
  };

  const selectAll = () => {
    const newSelections = entities
      .filter(e => !isSelected(e.id))
      .map(e => ({ type: e.type, id: e.id, name: e.name }));
    onSelectionChange([...selectedEntities, ...newSelections]);
  };

  const deselectAll = () => {
    const currentTabIds = entities.map(e => e.id);
    onSelectionChange(selectedEntities.filter(e => !currentTabIds.includes(e.id)));
  };

  const getSelectionCountByType = (type: TransferEntityType) =>
    selectedEntities.filter(e => e.type === type).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Select Entities to Transfer</Label>
        <Badge variant="secondary">{selectedEntities.length} selected</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TransferEntityType)}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {entityTypeConfig.map((config) => {
            const count = getSelectionCountByType(config.type);
            return (
              <TabsTrigger 
                key={config.type} 
                value={config.type}
                className="flex items-center gap-1.5"
              >
                <config.icon className="h-4 w-4" />
                {config.label}
                {count > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeTab}s...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <button
              type="button"
              onClick={selectAll}
              className="text-sm text-primary hover:underline"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="text-sm text-muted-foreground hover:underline"
            >
              Clear
            </button>
          </div>

          {entityTypeConfig.map((config) => (
            <TabsContent key={config.type} value={config.type} className="mt-0">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : entities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No {config.label.toLowerCase()} found
                </div>
              ) : (
                <ScrollArea className="h-[300px] rounded-md border">
                  <div className="p-4 space-y-2">
                    {entities.map((entity) => (
                      <div
                        key={entity.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => toggleEntity(entity)}
                      >
                        <Checkbox
                          checked={isSelected(entity.id)}
                          onCheckedChange={() => toggleEntity(entity)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entity.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ID: {entity.id.slice(0, 8)}...
                          </p>
                        </div>
                        {entity.created_at && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(entity.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
