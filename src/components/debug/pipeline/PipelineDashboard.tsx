import React, { useState, useEffect } from 'react';
import { usePipeline, DataSnapshot } from './PipelineContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { DiffViewer } from '@/components/documents/DiffViewer';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { ArrowRight, Trash2, Download, Eye, GitCommit, AlertTriangle, CheckCircle, XCircle, Edit, Save, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function PipelineDashboard() {
  const { snapshots, clear, isOpen, toggleDashboard, exportData, updateSnapshot } = usePipeline();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const selectedSnapshotIndex = snapshots.findIndex(s => s.id === selectedSnapshotId);
  const selectedSnapshot = snapshots[selectedSnapshotIndex];
  const previousSnapshot = selectedSnapshotIndex > 0 ? snapshots[selectedSnapshotIndex - 1] : null;

  // Calculate time delta
  const timeDelta = previousSnapshot && selectedSnapshot 
    ? selectedSnapshot.timestamp - previousSnapshot.timestamp 
    : 0;

  useEffect(() => {
    // Reset editing state when snapshot changes
    setIsEditing(false);
    setEditContent('');
    setEditError(null);
  }, [selectedSnapshotId]);

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(exportData());
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "pipeline_dump.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleEditStart = () => {
    if (selectedSnapshot) {
      setEditContent(JSON.stringify(selectedSnapshot.data, null, 2));
      setIsEditing(true);
      setShowDiff(false);
    }
  };

  const handleSave = () => {
    try {
      const parsedData = JSON.parse(editContent);
      if (selectedSnapshotId) {
        updateSnapshot(selectedSnapshotId, parsedData);
        setIsEditing(false);
        setEditError(null);
      }
    } catch (e) {
      setEditError("Invalid JSON: " + (e as Error).message);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
  };

  return (
    <Sheet open={isOpen} onOpenChange={toggleDashboard}>
      <SheetContent side="right" className="w-[800px] sm:w-[540px] md:w-[900px] flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center justify-between">
            <span>Pipeline Debugger</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="destructive" size="sm" onClick={clear}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: Snapshot List */}
          <div className="w-1/3 border-r bg-muted/10 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {snapshots.map((snapshot, index) => (
                  <Card
                    key={snapshot.id}
                    className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                      selectedSnapshotId === snapshot.id ? 'bg-accent border-primary' : ''
                    }`}
                    onClick={() => setSelectedSnapshotId(snapshot.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-xs">
                        {index + 1}. {snapshot.stage}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(snapshot.timestamp, 'HH:mm:ss')}
                      </span>
                    </div>
                    
                    {/* Validation Status Indicator */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {Object.keys(snapshot.data).length} keys
                      </div>
                      
                      {snapshot.validation ? (
                        snapshot.validation.valid ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] h-5 px-1">
                            <CheckCircle className="w-3 h-3 mr-1" /> Valid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] h-5 px-1">
                            <XCircle className="w-3 h-3 mr-1" /> {snapshot.validation.errors.length} Errors
                          </Badge>
                        )
                      ) : (
                         <Badge variant="outline" className="text-[10px] h-5 px-1 text-muted-foreground">
                            No Schema
                          </Badge>
                      )}
                    </div>
                  </Card>
                ))}
                {snapshots.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No data captured yet.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Main Content: Viewer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedSnapshot ? (
              <div className="flex flex-col h-full">
                <div className="p-2 border-b flex items-center justify-between bg-background">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {selectedSnapshot.stage}
                    </span>
                    {previousSnapshot && (
                      <div className="flex items-center gap-2">
                         <span className="text-xs text-muted-foreground flex items-center">
                            <ArrowRight className="w-3 h-3 mx-1" />
                            vs {previousSnapshot.stage}
                         </span>
                         <Badge variant="secondary" className="text-[10px] h-5">
                            +{timeDelta}ms
                         </Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <>
                        <Button
                          variant={showDiff ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setShowDiff(!showDiff)}
                          disabled={!previousSnapshot}
                        >
                          <GitCommit className="w-4 h-4 mr-2" />
                          Diff
                        </Button>
                        <Button
                          variant={!showDiff ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setShowDiff(false)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Raw
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleEditStart}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSave}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Validation Errors Panel */}
                {selectedSnapshot.validation && !selectedSnapshot.validation.valid && !isEditing && (
                    <div className="bg-red-50 border-b border-red-100 p-2 max-h-[150px] overflow-y-auto">
                        <div className="flex items-center gap-2 text-red-800 font-medium text-xs mb-1">
                            <AlertTriangle className="w-3 h-3" />
                            Validation Failed ({selectedSnapshot.validation.errors.length} errors)
                        </div>
                        <div className="space-y-1">
                            {selectedSnapshot.validation.errors.map((err: any, i: number) => (
                                <div key={i} className="text-[10px] text-red-600 font-mono pl-5 border-l-2 border-red-200 ml-1">
                                    <span className="font-semibold">{err.path}:</span> {err.message}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="flex-1 overflow-hidden">
                  {isEditing ? (
                    <div className="h-full flex flex-col">
                        {editError && (
                             <div className="bg-red-50 p-2 text-xs text-red-600 border-b border-red-200">
                                {editError}
                             </div>
                        )}
                        <Textarea 
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="flex-1 font-mono text-xs resize-none border-0 focus-visible:ring-0 p-4"
                            spellCheck={false}
                        />
                    </div>
                  ) : showDiff && previousSnapshot ? (
                    <DiffViewer
                      oldContent={JSON.stringify(previousSnapshot.data, null, 2)}
                      newContent={JSON.stringify(selectedSnapshot.data, null, 2)}
                      splitView={false}
                    />
                  ) : (
                    <ScrollArea className="h-full p-4">
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {JSON.stringify(selectedSnapshot.data, null, 2)}
                      </pre>
                    </ScrollArea>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a snapshot to view details
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
