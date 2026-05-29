// Four narrative tabs (internal_notes, extra_info, ai, lead_information)
// extracted from LeadWorkspaceSections.tsx. The rich-text editors for the
// internal_notes (description) and extra_info (notes) bodies use refs
// owned by the parent — the parent passes them in plus the execRichText
// + setDraftValue callbacks.

import type { RefObject } from 'react';
import { Bold, Italic, List, ListOrdered, Underline } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { sanitizeRichTextHtml, stripHtmlTags } from '@/lib/utils/sanitizer';

import { DESCRIPTION_MAX_LENGTH, NOTES_MAX_LENGTH, type BottomDraftState, type BottomTabKey, type BottomTextKey } from './types';

type RichTextTarget = 'description' | 'notes';
type RichTextCommand = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList';

interface LeadNarrativeTabsProps {
  enhancementsEnabled: boolean;
  loadedBottomTabs: Set<BottomTabKey>;
  bottomDraft: BottomDraftState;
  setDraftValue: (tab: BottomTextKey, value: string) => void;
  execRichText: (target: RichTextTarget, command: RichTextCommand) => void;
  narrativeValidationError: string | null;
  descriptionEditorRef: RefObject<HTMLDivElement>;
  notesEditorRef: RefObject<HTMLDivElement>;
  setBottomTab: (tab: BottomTabKey) => void;
}

export function LeadNarrativeTabs({
  enhancementsEnabled,
  loadedBottomTabs,
  bottomDraft,
  setDraftValue,
  execRichText,
  narrativeValidationError,
  descriptionEditorRef,
  notesEditorRef,
  setBottomTab,
}: LeadNarrativeTabsProps) {
  return (
    <>
      <TabsContent value="internal_notes">
        {loadedBottomTabs.has('internal_notes') ? (
          <div className="space-y-3">
            {enhancementsEnabled ? (
              <>
                {narrativeValidationError ? <p className="text-sm text-destructive">{narrativeValidationError}</p> : null}
                <div className="rounded-md border p-3">
                  <div className="mb-2 text-sm font-medium">Description</div>
                  <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'bold')} aria-label="Description Bold"><Bold className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'italic')} aria-label="Description Italic"><Italic className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'underline')} aria-label="Description Underline"><Underline className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'insertUnorderedList')} aria-label="Description Unordered list"><List className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'insertOrderedList')} aria-label="Description Ordered list"><ListOrdered className="h-4 w-4" /></Button>
                  </div>
                  <div
                    ref={descriptionEditorRef}
                    contentEditable
                    className="mt-2 min-h-[120px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    onFocus={() => setBottomTab('internal_notes')}
                    onInput={(event) => setDraftValue('description', sanitizeRichTextHtml((event.target as HTMLDivElement).innerHTML))}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stripHtmlTags(bottomDraft.description || '').length}/{DESCRIPTION_MAX_LENGTH} characters
                  </p>
                </div>
              </>
            ) : null}
            <Textarea
              value={bottomDraft.internal_notes}
              onChange={(e) => setDraftValue('internal_notes', e.target.value)}
              className="min-h-[140px]"
            />
          </div>
        ) : null}
      </TabsContent>
      <TabsContent value="extra_info">
        {loadedBottomTabs.has('extra_info') ? (
          <div className="space-y-3">
            {enhancementsEnabled ? (
              <>
                {narrativeValidationError ? <p className="text-sm text-destructive">{narrativeValidationError}</p> : null}
                <div className="rounded-md border p-3">
                  <div className="mb-2 text-sm font-medium">Notes</div>
                  <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'bold')} aria-label="Notes Bold"><Bold className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'italic')} aria-label="Notes Italic"><Italic className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'underline')} aria-label="Notes Underline"><Underline className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'insertUnorderedList')} aria-label="Notes Unordered list"><List className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'insertOrderedList')} aria-label="Notes Ordered list"><ListOrdered className="h-4 w-4" /></Button>
                  </div>
                  <div
                    ref={notesEditorRef}
                    contentEditable
                    className="mt-2 min-h-[120px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    onFocus={() => setBottomTab('extra_info')}
                    onInput={(event) => setDraftValue('notes', sanitizeRichTextHtml((event.target as HTMLDivElement).innerHTML))}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stripHtmlTags(bottomDraft.notes || '').length}/{NOTES_MAX_LENGTH} characters
                  </p>
                </div>
              </>
            ) : null}
            <Textarea
              value={bottomDraft.extra_info}
              onChange={(e) => setDraftValue('extra_info', e.target.value)}
              className="min-h-[140px]"
            />
          </div>
        ) : null}
      </TabsContent>
      <TabsContent value="ai">
        {loadedBottomTabs.has('ai') ? (
          <Textarea
            value={bottomDraft.ai}
            onChange={(e) => setDraftValue('ai', e.target.value)}
            className="min-h-[140px]"
          />
        ) : null}
      </TabsContent>
      <TabsContent value="lead_information">
        {loadedBottomTabs.has('lead_information') ? (
          <Textarea
            value={bottomDraft.lead_information}
            onChange={(e) => setDraftValue('lead_information', e.target.value)}
            className="min-h-[140px]"
          />
        ) : null}
      </TabsContent>
    </>
  );
}
