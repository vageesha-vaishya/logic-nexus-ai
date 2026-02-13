import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Bug, X, Maximize2, Minimize2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataInspectorProps {
  title?: string;
  data: Record<string, any>;
  className?: string;
  defaultOpen?: boolean;
}

export function DataInspector({ title = "Data Inspector", data, className, defaultOpen = false }: DataInspectorProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(Object.keys(data)[0] || 'all');
  const [copied, setCopied] = useState(false);

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn("fixed bottom-4 right-4 z-50 shadow-lg gap-2 bg-background", className)}
        onClick={() => setIsOpen(true)}
      >
        <Bug className="h-4 w-4 text-red-500" />
        <span className="text-xs font-mono">Debug Data</span>
      </Button>
    );
  }

  const handleCopy = (content: any) => {
    navigator.clipboard.writeText(JSON.stringify(content, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderJSON = (content: any) => {
    const jsonString = JSON.stringify(content, null, 2);
    return (
      <pre className="text-xs font-mono p-4 text-foreground whitespace-pre">
        {jsonString}
      </pre>
    );
  };

  return (
    <Card className={cn(
      "fixed bottom-4 right-4 z-50 shadow-2xl flex flex-col transition-all duration-200 bg-background border-red-200",
      isExpanded ? "w-[80vw] h-[80vh]" : "w-[500px] h-[600px]",
      className
    )}>
      <CardHeader className="p-3 border-b flex flex-row items-center justify-between space-y-0 bg-muted/20">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-red-500" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Badge variant="outline" className="text-[10px] font-mono">
            {Object.keys(data).length} Sections
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(data[activeTab] || data)}>
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
        <Tabs defaultValue={Object.keys(data)[0]} value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-3 pt-2 border-b bg-muted/10 flex-none">
            <TabsList className="w-full justify-start h-9 bg-transparent p-0 gap-2">
              {Object.keys(data).map((key) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="text-xs px-3 py-1 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border"
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {Object.entries(data).map(([key, value]) => (
            <TabsContent key={key} value={key} className="flex-1 min-h-0 m-0 p-0 relative data-[state=active]:flex flex-col">
              <div className="flex-1 w-full overflow-auto bg-muted/50 rounded-md">
                {renderJSON(value)}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
