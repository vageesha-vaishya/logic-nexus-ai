import { supabase } from '@/integrations/supabase/client';
import { diffLines } from 'diff';

// Use direct supabase calls with type assertions to avoid deep type instantiation errors

export interface Document {
  id: string;
  path: string;
  current_version: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: string;
  content: string;
  diff_summary: any;
  change_type: 'major' | 'minor' | 'patch';
  change_notes: string;
  created_by: string;
  created_at: string;
  author?: {
    email: string;
  };
}

export const DocumentService = {
  async getDocumentByPath(path: string): Promise<Document> {
    const { data, error } = await (supabase as any)
      .from('documents')
      .select('*')
      .eq('path', path)
      .single();
    
    if (error) throw error;
    return data as Document;
  },

  async getVersions(documentId: string): Promise<DocumentVersion[]> {
    const { data, error } = await (supabase as any)
      .from('document_versions')
      .select(`
        *,
        author:created_by (
          email
        )
      `)
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as DocumentVersion[];
  },

  async getVersion(documentId: string, version: string): Promise<DocumentVersion> {
    const { data, error } = await (supabase as any)
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .eq('version', version)
      .single();

    if (error) throw error;
    return data as DocumentVersion;
  },

  async createVersion(
    documentId: string, 
    content: string, 
    changeType: 'major' | 'minor' | 'patch', 
    notes: string
  ) {
    // Get latest version to calculate diff
    const { data: latestVersion } = await (supabase as any)
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let newVersionNumber = '1.0.0';
    let diffSummary = null;

    if (latestVersion) {
      const parts = (latestVersion.version as string).split('.').map(Number);
      if (changeType === 'major') {
        parts[0]++;
        parts[1] = 0;
        parts[2] = 0;
      } else if (changeType === 'minor') {
        parts[1]++;
        parts[2] = 0;
      } else {
        parts[2]++;
      }
      newVersionNumber = parts.join('.');

      // Calculate diff
      const diff = diffLines(latestVersion.content as string, content);
      diffSummary = {
        additions: diff.filter(p => p.added).length,
        deletions: diff.filter(p => p.removed).length,
        changes: diff.length
      };
    }

    const { data, error } = await (supabase as any)
      .from('document_versions')
      .insert({
        document_id: documentId,
        version: newVersionNumber,
        content,
        change_type: changeType,
        change_notes: notes,
        diff_summary: diffSummary,
        created_by: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();

    if (error) throw error;

    // Update document current_version
    await (supabase as any)
      .from('documents')
      .update({ 
        current_version: newVersionNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    return data;
  },

  async revertToVersion(documentId: string, targetVersion: string) {
    const version = await this.getVersion(documentId, targetVersion);
    return this.createVersion(
      documentId, 
      version.content, 
      'patch', 
      `Reverted to version ${targetVersion}`
    );
  }
};
