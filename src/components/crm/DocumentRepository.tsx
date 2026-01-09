import React, { useState } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  FileImage, 
  File, 
  Download, 
  Trash2, 
  MoreVertical,
  Grid,
  List as ListIcon,
  Search,
  Upload,
  FileIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  uploaded_at: string;
  uploaded_by: { name: string; avatar?: string };
  url: string;
  tags?: string[];
}

interface DocumentRepositoryProps {
  documents: Document[];
  onUpload?: () => void;
  onDownload?: (doc: Document) => void;
  onDelete?: (doc: Document) => void;
  className?: string;
}

const getFileIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />;
  if (t.includes('sheet') || t.includes('xls') || t.includes('csv')) return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
  if (t.includes('image') || t.includes('png') || t.includes('jpg')) return <FileImage className="h-8 w-8 text-blue-500" />;
  return <File className="h-8 w-8 text-slate-500" />;
};

export function DocumentRepository({ 
  documents: initialDocs, 
  onUpload, 
  onDownload, 
  onDelete,
  className 
}: DocumentRepositoryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredDocs = initialDocs.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className={cn("flex flex-col h-full space-y-4", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md p-1 bg-muted/20">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
          
          <Button onClick={onUpload}>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-[400px] border rounded-lg bg-slate-50/50 p-4">
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <FileIcon className="h-12 w-12 mb-4 opacity-20" />
            <p>No documents found</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredDocs.map((doc) => (
              <Card key={doc.id} className="group hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex flex-col items-center text-center space-y-3 relative">
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Open menu">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onDownload?.(doc)}>
                          <Download className="mr-2 h-4 w-4" /> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete?.(doc)} className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl mt-2">
                    {getFileIcon(doc.type)}
                  </div>
                  
                  <div className="w-full">
                    <h3 className="font-medium text-sm truncate" title={doc.name}>{doc.name}</h3>
                    <p className="text-xs text-muted-foreground">{doc.size} • {format(new Date(doc.uploaded_at), 'MMM d')}</p>
                  </div>

                  {doc.tags && (
                    <div className="flex flex-wrap justify-center gap-1 w-full">
                      {doc.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1.5">
                          {tag}
                        </Badge>
                      ))}
                      {doc.tags.length > 2 && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">+{doc.tags.length - 2}</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocs.map((doc) => (
              <div 
                key={doc.id} 
                className="flex items-center gap-4 p-3 bg-white rounded-lg border hover:border-slate-300 transition-colors group"
              >
                <div className="p-2 bg-slate-50 rounded-lg">
                  {React.cloneElement(getFileIcon(doc.type) as React.ReactElement, { className: "h-5 w-5" })}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{doc.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{doc.size}</span>
                    <span>•</span>
                    <span>Uploaded by {doc.uploaded_by.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-24 text-right">
                    {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
                  </span>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDownload?.(doc)} aria-label="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => onDelete?.(doc)} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
