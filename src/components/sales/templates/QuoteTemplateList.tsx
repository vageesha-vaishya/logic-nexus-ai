import React, { useState } from 'react';
import { useQuoteTemplates } from './useQuoteTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Copy, FileText } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { QuoteTemplate } from './types';

interface QuoteTemplateListProps {
  onSelect?: (template: QuoteTemplate) => void;
  onEdit?: (template: QuoteTemplate | null) => void;
}

export function QuoteTemplateList({ onSelect, onEdit }: QuoteTemplateListProps) {
  const { templates, isLoading, deleteTemplate } = useQuoteTemplates();
  const [search, setSearch] = useState('');

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div>Loading templates...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Quote Templates</h2>
          <p className="text-muted-foreground">Manage and use your quote templates.</p>
        </div>
        <Button onClick={() => onEdit?.(null)}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Add Category Filter here if needed */}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="group relative overflow-hidden transition-all hover:shadow-md">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="line-clamp-1 text-base">{template.name}</CardTitle>
                  <CardDescription className="line-clamp-2 text-xs">
                    {template.description || 'No description provided.'}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit?.(template)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => deleteTemplate.mutate(template.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="font-normal">
                  {template.category || 'General'}
                </Badge>
                <span>•</span>
                <span>v{template.version}</span>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/50 py-3">
              <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
                <span>Updated {format(new Date(template.updated_at), 'MMM d, yyyy')}</span>
                <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-background" onClick={() => onSelect?.(template)}>
                  <Copy className="mr-2 h-3 w-3" />
                  Use Template
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
        {filteredTemplates.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center animate-in fade-in-50">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No templates found</h3>
            <p className="mb-4 mt-2 text-sm text-muted-foreground">
              {search ? 'Try adjusting your search query.' : 'Get started by creating your first quote template.'}
            </p>
            {!search && (
              <Button onClick={() => onEdit?.(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
