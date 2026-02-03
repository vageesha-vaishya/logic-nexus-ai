import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Folder, FileText, ChevronRight, Home, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type HTSLevel = 'chapter' | 'heading' | 'subheading' | 'code';

interface HTSNode {
  code: string;
  description: string;
  child_count: number;
  has_children: boolean;
  id?: string;
}

interface BreadcrumbItem {
  level: HTSLevel;
  code: string;
  description: string;
}

interface VisualHTSBrowserProps {
  onSelect?: (selection: { code: string; description: string; id: string }) => void;
}

export function VisualHTSBrowser({ onSelect }: VisualHTSBrowserProps) {
  const [path, setPath] = useState<BreadcrumbItem[]>([]);
  
  const currentLevel: HTSLevel = 
    path.length === 0 ? 'chapter' :
    path.length === 1 ? 'heading' :
    path.length === 2 ? 'subheading' : 
    'code';
    
  const parentCode = path.length > 0 ? path[path.length - 1].code : null;

  const { data: nodes, isLoading, error } = useQuery({
    queryKey: ['global-hs-hierarchy', currentLevel, parentCode],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_global_hs_hierarchy', {
        level_type: currentLevel,
        parent_code: parentCode
      });
      
      if (error) throw error;
      return data as HTSNode[];
    }
  });

  const handleNavigate = (node: HTSNode) => {
    if (node.has_children) {
      setPath([...path, { 
        level: currentLevel, 
        code: node.code, 
        description: node.description 
      }]);
    } else {
      // Leaf node clicked (Code level)
      if (onSelect && node.id) {
        onSelect({
          code: node.code,
          description: node.description,
          id: node.id
        });
      }
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    setPath(path.slice(0, index + 1));
  };

  const handleHomeClick = () => {
    setPath([]);
  };
  
  const handleBack = () => {
    if (path.length > 0) {
      setPath(path.slice(0, path.length - 1));
    }
  };

  const getLevelLabel = (level: HTSLevel) => {
    switch(level) {
      case 'chapter': return 'Chapters';
      case 'heading': return 'Headings';
      case 'subheading': return 'Subheadings';
      case 'code': return 'Codes';
      default: return '';
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground p-2 bg-muted/30 rounded-md">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleHomeClick}>
          <Home className="h-4 w-4" />
        </Button>
        <ChevronRight className="h-4 w-4" />
        {path.map((item, index) => (
          <div key={item.code} className="flex items-center">
            <Button 
              variant="ghost" 
              className="h-6 px-2 text-sm font-normal"
              onClick={() => handleBreadcrumbClick(index)}
            >
              {item.code}
            </Button>
            {index < path.length - 1 && <ChevronRight className="h-4 w-4" />}
          </div>
        ))}
        <div className="flex-1" />
        {path.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleBack} className="h-7">
            <ArrowLeft className="h-3 w-3 mr-1" /> Back
          </Button>
        )}
      </div>

      <div className="flex-1">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Browsing {getLevelLabel(currentLevel)}
            {parentCode && <span className="text-muted-foreground font-normal ml-2">in {parentCode}</span>}
          </h2>
          {path.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {path[path.length - 1].description}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-red-500 border border-red-200 rounded-md bg-red-50">
            Error loading data: {(error as Error).message}
          </div>
        ) : nodes && nodes.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            No items found in this category.
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
              {nodes?.map((node) => (
                <Card 
                  key={node.code} 
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/50 border-l-4",
                    node.has_children ? "border-l-blue-500" : "border-l-green-500"
                  )}
                  onClick={() => handleNavigate(node)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {node.has_children ? (
                            <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-green-500 flex-shrink-0" />
                          )}
                          <span className="font-mono font-bold text-base">{node.code}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3 leading-snug">
                          {node.description}
                        </p>
                      </div>
                    </div>
                    {node.has_children && (
                      <div className="mt-3 flex justify-end">
                        <Badge variant="secondary" className="text-xs">
                          {node.child_count} items
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
