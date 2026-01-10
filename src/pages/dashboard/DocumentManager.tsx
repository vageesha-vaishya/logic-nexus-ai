import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DocumentService, DocumentVersion, Document } from '@/lib/document-service';
import { VersionHistory } from '@/components/documents/VersionHistory';
import { DiffViewer } from '@/components/documents/DiffViewer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, History, FileText, Split, Eye } from 'lucide-react';

export default function DocumentManager() {
  const [document, setDocument] = useState<Document | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
  const [currentContent, setCurrentContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  
  // New version form state
  const [changeType, setChangeType] = useState<'major' | 'minor' | 'patch'>('patch');
  const [changeNotes, setChangeNotes] = useState('');

  // Hardcoded path for this specific task, but could be dynamic
  const DOC_PATH = 'docs/COMPETITIVE_ANALYSIS_AND_ROADMAP.md';

  useEffect(() => {
    loadDocument();
  }, []);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const doc = await DocumentService.getDocumentByPath(DOC_PATH);
      setDocument(doc);
      
      const vers = await DocumentService.getVersions(doc.id);
      setVersions(vers);
      
      if (vers.length > 0) {
        setCurrentContent(vers[0].content);
        setSelectedVersion(vers[0]);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!document) return;
    if (!changeNotes.trim()) {
      toast.error('Please add change notes');
      return;
    }

    try {
      setSaving(true);
      await DocumentService.createVersion(
        document.id,
        currentContent,
        changeType,
        changeNotes
      );
      toast.success('Version saved successfully');
      setChangeNotes('');
      setChangeType('patch');
      await loadDocument();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save version');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async (version: DocumentVersion) => {
    if (!document || !window.confirm(`Revert to version ${version.version}?`)) return;
    
    try {
      setSaving(true);
      await DocumentService.revertToVersion(document.id, version.version);
      toast.success(`Reverted to version ${version.version}`);
      await loadDocument();
    } catch (error) {
      console.error(error);
      toast.error('Failed to revert version');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold">Document Not Found</h2>
          <p className="text-muted-foreground">Please run the migration to initialize the document.</p>
        </div>
      </div>
    );
  }

  const latestVersion = versions[0];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - History */}
      <VersionHistory 
        versions={versions}
        currentVersionId={selectedVersion?.id}
        onSelectVersion={setSelectedVersion}
        onRevert={handleRevert}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b p-4 flex items-center justify-between bg-card">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold truncate">Competitive Analysis & Roadmap</h1>
            <Badge variant="outline">v{document.current_version}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[400px]">
              <TabsList>
                <TabsTrigger value="edit" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Edit
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Preview
                </TabsTrigger>
                <TabsTrigger value="diff" className="flex items-center gap-2">
                  <Split className="h-4 w-4" /> Compare
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-6">
          {activeTab === 'edit' && (
            <div className="h-full flex flex-col gap-4">
              <Card className="flex-1 flex flex-col min-h-0">
                <Textarea
                  value={currentContent}
                  onChange={(e) => setCurrentContent(e.target.value)}
                  className="flex-1 font-mono text-sm resize-none border-0 focus-visible:ring-0 p-4"
                  placeholder="# Markdown content..."
                />
              </Card>
              
              <Card className="p-4 bg-muted/30">
                <div className="flex items-end gap-4">
                  <div className="grid gap-2 flex-1">
                    <label className="text-sm font-medium">Change Notes</label>
                    <Input 
                      value={changeNotes} 
                      onChange={(e) => setChangeNotes(e.target.value)}
                      placeholder="Describe your changes..." 
                    />
                  </div>
                  <div className="grid gap-2 w-32">
                    <label className="text-sm font-medium">Type</label>
                    <Select value={changeType} onValueChange={(v: any) => setChangeType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="patch">Patch</SelectItem>
                        <SelectItem value="minor">Minor</SelectItem>
                        <SelectItem value="major">Major</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Version
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'preview' && (
            <Card className="h-full overflow-hidden">
              <ScrollArea className="h-full p-8 prose dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {currentContent}
                </ReactMarkdown>
              </ScrollArea>
            </Card>
          )}

          {activeTab === 'diff' && selectedVersion && (
            <Card className="h-full flex flex-col overflow-hidden">
              <CardHeader className="py-3 border-b bg-muted/10">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>Comparing v{latestVersion.version} (Latest) vs v{selectedVersion.version}</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      -{selectedVersion.diff_summary?.deletions || 0}
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      +{selectedVersion.diff_summary?.additions || 0}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 min-h-0">
                <DiffViewer 
                  oldContent={selectedVersion.content} 
                  newContent={latestVersion.content} 
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
