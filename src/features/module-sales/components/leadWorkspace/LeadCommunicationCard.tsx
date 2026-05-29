// Communication card (Send Message / Notes / Lead Activities) extracted
// from LeadWorkspaceSections.tsx. Receives the three tab subtrees as
// callable handlers; the Lead Activities timeline still mounts the
// LeadActivitiesTimeline component directly.

import type { KeyboardEvent, RefObject } from 'react';
import { Pencil, Plus, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { LeadActivitiesTimeline } from '@/features/module-sales/components/LeadActivitiesTimeline';
import type { LeadWorkspaceEventBus } from '@/features/module-sales/components/lead-workspace-bus';

import type { CommunicationTabKey } from './types';

interface CommunicationNote {
  id: string;
  description: string;
  created_at: string;
}

interface LeadCommunicationCardProps {
  scrollingEnabled: boolean;
  containerRef: RefObject<HTMLDivElement>;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;

  communicationTab: CommunicationTabKey;
  setCommunicationTab: (tab: CommunicationTabKey) => void;
  loadedCommunicationTabs: Set<CommunicationTabKey>;

  // send_message tab
  composerSubject: string;
  setComposerSubject: (value: string) => void;
  composerBody: string;
  setComposerBody: (value: string) => void;
  applyTemplate: (template: 'follow_up' | 'meeting' | 'proposal') => void;
  sendMessage: () => void;

  // notes tab
  notes: CommunicationNote[];
  notesDraft: string;
  setNotesDraft: (value: string) => void;
  editingNoteId: string | null;
  setEditingNoteId: (id: string | null) => void;
  editingNoteValue: string;
  setEditingNoteValue: (value: string) => void;
  saveNote: () => void;
  updateNote: () => void;

  // lead_activities tab
  leadId: string | undefined;
  eventBus: LeadWorkspaceEventBus;
}

export function LeadCommunicationCard({
  scrollingEnabled,
  containerRef,
  onScroll,
  onKeyDown,
  communicationTab,
  setCommunicationTab,
  loadedCommunicationTabs,
  composerSubject,
  setComposerSubject,
  composerBody,
  setComposerBody,
  applyTemplate,
  sendMessage,
  notes,
  notesDraft,
  setNotesDraft,
  editingNoteId,
  setEditingNoteId,
  editingNoteValue,
  setEditingNoteValue,
  saveNote,
  updateNote,
  leadId,
  eventBus,
}: LeadCommunicationCardProps) {
  return (
    <Card className={cn(scrollingEnabled && 'xl:flex xl:min-h-0 xl:flex-col')}>
      <CardHeader className={cn(scrollingEnabled && 'xl:sticky xl:top-0 xl:z-10 xl:border-b xl:bg-card')}>
        <CardTitle>Communication</CardTitle>
      </CardHeader>
      <CardContent
        ref={containerRef}
        className={cn(
          scrollingEnabled &&
            'xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:scroll-smooth xl:pr-2 xl:scrollbar-thin xl:scrollbar-thumb-gray-300 xl:scrollbar-track-transparent dark:xl:scrollbar-thumb-gray-600 xl:touch-pan-y',
        )}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        aria-label="Communication section"
      >
        <Tabs
          value={communicationTab}
          onValueChange={(value) => setCommunicationTab(value as CommunicationTabKey)}
          orientation="vertical"
          className="flex flex-col items-start justify-start gap-4 md:flex-row"
        >
          <TabsList className="flex h-auto w-full flex-row flex-wrap items-start justify-start gap-1 self-start md:w-[180px] md:flex-col md:flex-nowrap">
            <TabsTrigger value="send_message" className="min-h-11 justify-start px-3 text-left">Send Message</TabsTrigger>
            <TabsTrigger value="notes" className="min-h-11 justify-start px-3 text-left">Notes</TabsTrigger>
            <TabsTrigger value="lead_activities" className="min-h-11 justify-start px-3 text-left">Lead Activities</TabsTrigger>
          </TabsList>
          <div className="flex-1 self-start">
            <TabsContent value="send_message" className="mt-0 space-y-3">
              {loadedCommunicationTabs.has('send_message') ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate('follow_up')}>Follow-up</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate('meeting')}>Meeting</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate('proposal')}>Proposal</Button>
                  </div>
                  <Input value={composerSubject} onChange={(e) => setComposerSubject(e.target.value)} placeholder="Subject" />
                  <Textarea
                    value={composerBody}
                    onChange={(e) => setComposerBody(e.target.value)}
                    className="min-h-[140px]"
                    placeholder="Write message..."
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" size="icon" onClick={sendMessage} aria-label="Send message" title="Send Message">
                          <Send className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Send Message</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              ) : null}
            </TabsContent>
            <TabsContent value="notes" className="mt-0 space-y-3">
              {loadedCommunicationTabs.has('notes') ? (
                <>
                  <div className="space-y-2">
                    {notes.map((note) => (
                      <div key={note.id} className="rounded-md border p-2">
                        {editingNoteId === note.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingNoteValue}
                              onChange={(e) => setEditingNoteValue(e.target.value)}
                              className="min-h-[88px]"
                            />
                            <div className="flex gap-2">
                              <Button type="button" size="sm" onClick={updateNote}>Save</Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm whitespace-pre-wrap">{note.description}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString()}</span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-blue-600 hover:text-blue-700"
                                      onClick={() => {
                                        setEditingNoteId(note.id);
                                        setEditingNoteValue(note.description);
                                      }}
                                      aria-label="Edit note"
                                      title="Edit"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <Textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    className="min-h-[90px]"
                    placeholder="Add note..."
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={saveNote}
                          aria-label="Add note"
                          title="Add Note"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add Note</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              ) : null}
            </TabsContent>
            <TabsContent value="lead_activities" className="mt-0 space-y-3">
              {loadedCommunicationTabs.has('lead_activities') ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => eventBus.emit('activities:filter', { type: 'call' })}>Call</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => eventBus.emit('activities:filter', { type: 'email' })}>Email</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => eventBus.emit('activities:filter', { type: 'meeting' })}>Meeting</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => eventBus.emit('activities:filter', { type: 'all' })}>All</Button>
                  </div>
                  {leadId ? (
                    <LeadActivitiesTimeline leadId={leadId} eventBus={eventBus} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Save lead first to view timeline</p>
                  )}
                </>
              ) : null}
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
