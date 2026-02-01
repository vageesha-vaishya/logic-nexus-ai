import React, { useEffect, useState, useMemo, useRef } from 'react';
import { debugStore, DebugConfig } from '@/lib/debug-store';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Settings, 
  Trash2, 
  Download, 
  Pause, 
  Play, 
  Filter, 
  Search,
  ChevronDown,
  ChevronRight,
  Globe,
  Database,
  Server,
  FolderTree,
  XCircle,
  AlertTriangle,
  Info,
  ArrowLeftRight,
  ArrowDown,
  ArrowUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Error Boundary for Debug Console to prevent UI disappearance
class DebugErrorBoundary extends React.Component<{ children: React.ReactNode, onReset: () => void }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("DebugConsole Render Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 m-4 text-red-500 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-md">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-bold">Render Error</h3>
          </div>
          <p className="text-sm mb-2 text-muted-foreground">The console encountered an error while rendering logs. This usually happens with malformed log data.</p>
          <div className="bg-background p-2 rounded border mb-4 overflow-auto max-h-32">
             <p className="text-xs font-mono text-red-600 dark:text-red-400">{this.state.error?.message}</p>
          </div>
          <Button onClick={() => {
            this.props.onReset();
            this.setState({ hasError: false, error: null });
          }} variant="destructive" size="sm">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Logs & Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SyntaxHighlighter = ({ data }: { data: any }) => {
  if (!data) return <span className="text-muted-foreground">(No Data)</span>;
  
  let json = '';
  try {
    json = typeof data === 'string' ? (data.startsWith('{') || data.startsWith('[') ? JSON.stringify(JSON.parse(data), null, 2) : data) : JSON.stringify(data, null, 2);
  } catch {
    json = String(data);
  }

  if (!json.startsWith('{') && !json.startsWith('[')) {
     return <pre className="bg-muted/50 p-3 rounded-md text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap">{json}</pre>;
  }
  
  // Basic syntax highlighting
  const html = json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'text-orange-600 dark:text-orange-400'; // number
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'text-blue-600 dark:text-blue-400 font-semibold'; // key
      } else {
        cls = 'text-green-600 dark:text-green-400'; // string
      }
    } else if (/true|false/.test(match)) {
      cls = 'text-purple-600 dark:text-purple-400 font-bold'; // boolean
    } else if (/null/.test(match)) {
      cls = 'text-gray-500 font-bold'; // null
    }
    return `<span class="${cls}">${match}</span>`;
  });

  return (
    <pre 
      className="bg-muted/50 p-3 rounded-md text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const safeString = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
     try {
       return JSON.stringify(val);
     } catch {
       return '[Object]';
     }
  }
  return String(val);
};

const LogDetail = ({ log }: { log: any }) => {
  const [expanded, setExpanded] = useState(false);

  if (log.type === 'data-flow') {
    return (
      <div className="border-b last:border-0">
        <div 
          className={cn(
            "flex items-center p-2 cursor-pointer hover:bg-muted/50 text-sm font-mono",
            (log.status === 'error' || (typeof log.status === 'number' && log.status >= 400)) ? "text-red-500" : 
            log.status === 'warning' ? "text-yellow-500" : "text-blue-600"
          )}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="w-4">{expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</span>
          <span className="w-8 flex justify-center" title={log.flowType}>
             {log.flowType === 'inbound' ? <ArrowDown className="h-4 w-4" /> : 
              log.flowType === 'outbound' ? <ArrowUp className="h-4 w-4" /> :
              <ArrowLeftRight className="h-4 w-4" />}
          </span>
          <span className="w-20 font-bold uppercase truncate" title={log.source}>{safeString(log.source)}</span>
          <span className="w-24 font-semibold truncate" title={log.operation}>{safeString(log.operation)}</span>
          <span className="flex-1 truncate px-2" title={safeString(log.target)}>{safeString(log.target)}</span>
          <span className="w-16 text-right text-muted-foreground">{log.duration ? `${log.duration}ms` : ''}</span>
          <span className="w-24 text-right text-xs text-muted-foreground ml-2">{new Date(log.timestamp).toLocaleTimeString()}</span>
        </div>
        
        {expanded && (
          <div className="p-4 bg-muted/30 text-xs overflow-x-auto">
             <Tabs defaultValue="payload">
               <TabsList className="mb-2">
                 <TabsTrigger value="payload">Payload</TabsTrigger>
                 <TabsTrigger value="meta">Metadata</TabsTrigger>
                 {log.request && <TabsTrigger value="network">Network Details</TabsTrigger>}
               </TabsList>
               
               <TabsContent value="payload" className="space-y-2">
                 {log.flowType === 'transformation' && log.payload && log.payload.input && log.payload.output ? (
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <div className="font-semibold text-xs mb-1 text-muted-foreground">Input</div>
                       <SyntaxHighlighter data={log.payload.input} />
                     </div>
                     <div>
                       <div className="font-semibold text-xs mb-1 text-muted-foreground">Output</div>
                       <SyntaxHighlighter data={log.payload.output} />
                     </div>
                   </div>
                 ) : (
                   <>
                     <div className="font-semibold">Data Payload:</div>
                     <SyntaxHighlighter data={log.payload || log.data || (log.response && log.response.body) || (log.request && log.request.body)} />
                   </>
                 )}
               </TabsContent>
               
               <TabsContent value="meta" className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div><span className="font-semibold">Flow Type:</span> {safeString(log.flowType)}</div>
                      <div><span className="font-semibold">Source:</span> {safeString(log.source)}</div>
                      <div><span className="font-semibold">Operation:</span> {safeString(log.operation)}</div>
                      <div><span className="font-semibold">Target:</span> {safeString(log.target)}</div>
                    </div>
                    <div>
                      <div><span className="font-semibold">Timestamp:</span> {log.timestamp}</div>
                      <div><span className="font-semibold">Duration:</span> {log.duration}ms</div>
                      <div><span className="font-semibold">Status:</span> {log.status}</div>
                      <div><span className="font-semibold">Correlation ID:</span> {safeString(log.correlationId)}</div>
                    </div>
                  </div>
               </TabsContent>
               
               {log.request && (
                 <TabsContent value="network">
                    <div className="grid grid-cols-1 gap-4">
                       <div>
                         <div className="font-semibold">URL:</div>
                         <div className="break-all">{safeString(log.url)}</div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                         <div>
                            <div className="font-semibold">Request Headers:</div>
                            <SyntaxHighlighter data={log.request.headers} />
                         </div>
                         <div>
                            <div className="font-semibold">Response Headers:</div>
                            <SyntaxHighlighter data={log.response.headers} />
                         </div>
                       </div>
                    </div>
                 </TabsContent>
               )}
             </Tabs>
          </div>
        )}
      </div>
    );
  }

  if (log.type === 'app') {
    return (
      <div className="border-b last:border-0">
        <div 
          className={cn(
            "flex items-center p-2 cursor-pointer hover:bg-muted/50 text-sm font-mono",
            log.level === 'error' ? "text-red-500" : 
            (log.level === 'warn' || log.level === 'warning') ? "text-yellow-500" : 
            log.level === 'info' ? "text-blue-500" : "text-muted-foreground"
          )}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="w-4">{expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</span>
          <span className="w-20 font-bold uppercase">{safeString(log.level)}</span>
          <span className="w-32 text-muted-foreground truncate" title={`${safeString(log.module)}${log.form ? `:${safeString(log.form)}` : ''}`}>
            {safeString(log.module)}{log.form ? `:${safeString(log.form)}` : ''}
          </span>
          <span className="flex-1 truncate" title={safeString(log.message)}>{safeString(log.message)}</span>
          <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
        </div>
        
        {expanded && (
          <div className="p-4 bg-muted/30 text-xs overflow-x-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-semibold mb-1">Details:</div>
                <div className="space-y-1 text-muted-foreground">
                   <div>Module: <span className="text-foreground">{safeString(log.module)}</span></div>
                   <div>Form: <span className="text-foreground">{safeString(log.form || 'N/A')}</span></div>
                   <div>Timestamp: <span className="text-foreground">{log.timestamp}</span></div>
                </div>
              </div>
              <div>
                <div className="font-semibold mb-1">Data Payload:</div>
                <SyntaxHighlighter data={log.data} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-b last:border-0">
      <div 
        className={cn(
          "flex items-center p-2 cursor-pointer hover:bg-muted/50 text-sm font-mono",
          log.status >= 400 ? "text-red-500" : log.status >= 300 ? "text-yellow-500" : "text-green-500"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-4">{expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</span>
        <span className="w-20 font-bold">{safeString(log.method)}</span>
        <span className="w-16">{log.status}</span>
        <span className="w-20 text-muted-foreground">{log.duration}ms</span>
        <span className="flex-1 truncate" title={safeString(log.url)}>{safeString(log.url)}</span>
        <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
      </div>
      
      {expanded && (
        <div className="p-4 bg-muted/30 text-xs overflow-x-auto">
          <Tabs defaultValue="response">
            <TabsList className="mb-2">
              <TabsTrigger value="request">Request</TabsTrigger>
              <TabsTrigger value="response">Response</TabsTrigger>
              <TabsTrigger value="meta">Metadata</TabsTrigger>
            </TabsList>
            
            <TabsContent value="request" className="space-y-2">
              <div className="font-semibold">Headers:</div>
              <SyntaxHighlighter data={log.request.headers} />
              <div className="font-semibold mt-2">Body:</div>
              <SyntaxHighlighter data={log.request.body} />
            </TabsContent>
            
            <TabsContent value="response" className="space-y-2">
              <div className="font-semibold">Headers:</div>
              <SyntaxHighlighter data={log.response.headers} />
              <div className="font-semibold mt-2">Body:</div>
              <SyntaxHighlighter data={log.response.body} />
            </TabsContent>

            <TabsContent value="meta" className="space-y-2">
               <div><span className="font-semibold">Timestamp:</span> {log.timestamp}</div>
               <div><span className="font-semibold">Correlation ID:</span> {safeString(log.correlationId)}</div>
               <div><span className="font-semibold">Duration:</span> {log.duration}ms</div>
               <div><span className="font-semibold">Method:</span> {safeString(log.method)}</div>
               <div><span className="font-semibold">URL:</span> {safeString(log.url)}</div>
               <div><span className="font-semibold">Status:</span> {log.status}</div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

// Helper to build hierarchy from flat scopes
const buildScopeTree = (scopes: Record<string, boolean>) => {
  const root: any = { children: {} };
  
  Object.keys(scopes).sort().forEach(path => {
    const parts = path.split(':');
    let current = root;
    parts.forEach((part, index) => {
      if (!current.children[part]) {
        current.children[part] = { 
           name: part, 
           path: parts.slice(0, index + 1).join(':'), 
           children: {} 
        };
      }
      current = current.children[part];
    });
  });
  return root.children;
};

const ScopeNode = ({ node, config }: { node: any, config: DebugConfig }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = Object.keys(node.children).length > 0;
  // If specific scope is explicitly false, it's disabled. Default true.
  const isEnabled = config.scopes[node.path] !== false; 
  
  return (
    <div className="pl-2">
      <div className="flex items-center gap-2 py-1">
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5 hover:bg-muted rounded">
             {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : <div className="w-4" />}
        
        <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
          <span className="text-sm truncate" title={node.path}>{node.name}</span>
          <Switch 
            checked={isEnabled} 
            onCheckedChange={(c) => debugStore.toggleScope(node.path, c)}
            disabled={!config.enabled}
            className="scale-75 origin-right"
          />
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="ml-2 border-l border-border/50 pl-2">
          {Object.values(node.children).map((child: any) => (
             <ScopeNode key={child.path} node={child} config={config} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function DebugConsole() {
  const [config, setConfig] = useState<DebugConfig>(debugStore.getConfig());
  const [logs, setLogs] = useState<any[]>(debugStore.getLogs());
  const [filter, setFilter] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [dataFlowFilters, setDataFlowFilters] = useState<Record<string, boolean>>({
    inbound: true,
    outbound: true,
    transformation: true,
    validation: true
  });
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
  };

  const filteredLogs = useMemo(() => {
    let result = logs;
    
    // Type Filter
    if (activeTab !== 'all') {
        if (activeTab === 'network') result = result.filter(l => l.type === 'network');
        else if (activeTab === 'app') result = result.filter(l => l.type === 'app');
        else if (activeTab === 'data') {
            result = result.filter(l => 
              l.type === 'data-flow' && 
              dataFlowFilters[l.flowType] !== false
            );
        }
    }

    if (!filter) return result;
    const lower = filter.toLowerCase();
    return result.filter(l => {
      if (l.type === 'data-flow') {
        return (
          safeString(l.source).toLowerCase().includes(lower) ||
          safeString(l.operation).toLowerCase().includes(lower) ||
          safeString(l.target).toLowerCase().includes(lower)
        );
      }
      if (l.type === 'app') {
        return (
          safeString(l.module).toLowerCase().includes(lower) ||
          (l.form && safeString(l.form).toLowerCase().includes(lower)) ||
          safeString(l.message).toLowerCase().includes(lower) ||
          safeString(l.level).toLowerCase().includes(lower)
        );
      }
      // Network
      return (
        (l.url && safeString(l.url).toLowerCase().includes(lower)) || 
        (l.method && safeString(l.method).toLowerCase().includes(lower)) ||
        String(l.status).includes(lower)
      );
    });
  }, [logs, filter, activeTab]);

  // Auto-scroll on new logs
  useEffect(() => {
    if (!isPaused && filteredLogs.length > 0) {
        scrollToBottom();
    }
  }, [filteredLogs.length, isPaused]);

  useEffect(() => {
    // Subscribe to config changes and log updates
    const unsubConfig = debugStore.subscribe(() => {
      setConfig(debugStore.getConfig());
      if (!isPaused) {
        setLogs([...debugStore.getLogs()]);
      }
    });

    return () => {
        unsubConfig();
    };
  }, [isPaused]);

  const toggleEnabled = () => debugStore.updateConfig({ enabled: !config.enabled });
  
  const updateNetwork = (key: keyof DebugConfig['network'], value: any) => {
    debugStore.updateNetworkConfig({ [key]: value });
  };

  const clearLogs = () => {
    debugStore.clearLogs();
    setLogs([]);
  };

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col p-4 gap-4 h-auto md:h-[calc(100vh-4rem)]">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          System Debug Console
        </h1>
        <div className="flex items-center gap-2">
           <Badge variant={config.enabled ? "default" : "secondary"}>
             {config.enabled ? "Active" : "Disabled"}
           </Badge>
           <Switch checked={config.enabled} onCheckedChange={toggleEnabled} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:flex-1 md:min-h-0 h-auto">
        {/* Settings Panel */}
        <Card className="col-span-1 flex flex-col md:h-full h-auto">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-4 w-4" /> Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 md:min-h-0 overflow-y-auto h-auto flex flex-col">
            <div className="md:h-full h-auto flex flex-col p-4 gap-6">
                
                {/* Fixed Configuration Section */}
                <div className="flex-shrink-0 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Globe className="h-4 w-4" /> Network Capture
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Request Headers</label>
                        <Switch 
                          checked={config.network.captureRequestHeaders} 
                          onCheckedChange={(c) => updateNetwork('captureRequestHeaders', c)} 
                          disabled={!config.enabled}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Request Body</label>
                        <Switch 
                          checked={config.network.captureRequestBody} 
                          onCheckedChange={(c) => updateNetwork('captureRequestBody', c)} 
                          disabled={!config.enabled}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Response Headers</label>
                        <Switch 
                          checked={config.network.captureResponseHeaders} 
                          onCheckedChange={(c) => updateNetwork('captureResponseHeaders', c)} 
                          disabled={!config.enabled}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Response Body</label>
                        <Switch 
                          checked={config.network.captureResponseBody} 
                          onCheckedChange={(c) => updateNetwork('captureResponseBody', c)} 
                          disabled={!config.enabled}
                        />
                      </div>
                      <div className="space-y-1 pt-2">
                        <label className="text-xs text-muted-foreground">Max Payload Size (chars)</label>
                        <Input 
                          type="number"
                          value={config.network.maxPayloadSize || 5000}
                          onChange={(e) => updateNetwork('maxPayloadSize', parseInt(e.target.value) || 5000)}
                          disabled={!config.enabled}
                          min={100}
                          max={1000000}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Filter className="h-4 w-4" /> Filters
                    </h3>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">URL Patterns (Regex)</label>
                      <Input 
                        value={config.network.urlPatterns.join(', ')}
                        onChange={(e) => updateNetwork('urlPatterns', e.target.value.split(',').map(s => s.trim()))}
                        placeholder=".*, /api/v1"
                        disabled={!config.enabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Ignored URLs</label>
                      <Input 
                        value={config.network.ignoredUrls.join(', ')}
                        onChange={(e) => updateNetwork('ignoredUrls', e.target.value.split(',').map(s => s.trim()))}
                        disabled={!config.enabled}
                      />
                    </div>
                  </div>
                </div>

                {/* Scrollable Scopes Section */}
                <div className="flex flex-col space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2 flex-shrink-0">
                    <FolderTree className="h-4 w-4" /> Debug Scopes
                  </h3>
                  <div className="min-h-[200px] pr-2 border rounded-md p-2 bg-muted/10">
                    <div className="space-y-1">
                      {Object.keys(config.scopes).length === 0 ? (
                        <div className="text-xs text-muted-foreground p-2">No scopes discovered yet. Navigate the app to populate.</div>
                      ) : (
                        Object.values(buildScopeTree(config.scopes)).map((node: any) => (
                          <ScopeNode key={node.path} node={node} config={config} />
                        ))
                      )}
                    </div>
                  </div>
                </div>

            </div>
          </CardContent>
        </Card>

        {/* Logs Panel */}
        <Card className="col-span-1 md:col-span-3 flex flex-col md:h-full h-[600px]">
          <CardHeader className="py-3 px-4 border-b space-y-3">
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">All Logs</TabsTrigger>
                  <TabsTrigger value="data" className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4" /> Data Flow
                  </TabsTrigger>
                  <TabsTrigger value="network" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Network
                  </TabsTrigger>
                  <TabsTrigger value="app" className="flex items-center gap-2">
                    <Server className="h-4 w-4" /> System
                  </TabsTrigger>
                </TabsList>
             </Tabs>
             
             {/* Data Flow Sub-filters */}
             {activeTab === 'data' && (
               <div className="flex items-center gap-4 py-2 px-1 text-xs border-b mb-2">
                 <span className="font-semibold text-muted-foreground">Filters:</span>
                 {Object.keys(dataFlowFilters).map(key => (
                   <div key={key} className="flex items-center gap-2">
                     <Checkbox 
                       id={`filter-${key}`}
                       checked={dataFlowFilters[key]}
                       onCheckedChange={(c) => setDataFlowFilters(prev => ({ ...prev, [key]: !!c }))}
                     />
                     <label htmlFor={`filter-${key}`} className="capitalize cursor-pointer select-none">
                       {key}
                     </label>
                   </div>
                 ))}
               </div>
             )}

             <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <div className="relative">
                   <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                   <Input 
                     placeholder="Search logs..." 
                     className="pl-8 w-64 h-9" 
                     value={filter}
                     onChange={(e) => setFilter(e.target.value)}
                   />
                 </div>
                 <Badge variant="outline" className="font-mono">
                   {filteredLogs.length} events
                 </Badge>
               </div>
               <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" onClick={() => setIsPaused(!isPaused)}>
                   {isPaused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                   {isPaused ? "Resume" : "Pause"}
                 </Button>
                 <Button variant="outline" size="sm" onClick={clearLogs}>
                   <Trash2 className="h-4 w-4 mr-1" /> Clear
                 </Button>
                 <Button variant="outline" size="sm" onClick={exportLogs}>
                   <Download className="h-4 w-4 mr-1" /> Export
                 </Button>
               </div>
             </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden min-h-0 relative">
             <ScrollArea className="h-full" ref={scrollAreaRef}>
               <DebugErrorBoundary onReset={clearLogs}>
                 <div className="flex flex-col min-w-full">
                   {filteredLogs.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                       <Activity className="h-12 w-12 mb-4 opacity-20" />
                       <p>No logs captured yet.</p>
                       <p className="text-sm">Ensure Debugging is Active and interact with the app.</p>
                     </div>
                   ) : (
                     <>
                      {filteredLogs.map((log, i) => (
                        <LogDetail key={i} log={log} />
                      ))}
                      <div ref={logsEndRef} />
                     </>
                   )}
                 </div>
               </DebugErrorBoundary>
             </ScrollArea>
             {showScrollButton && (
                <Button 
                  size="icon" 
                  variant="secondary" 
                  className="absolute bottom-4 right-4 rounded-full shadow-lg opacity-80 hover:opacity-100"
                  onClick={scrollToBottom}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
