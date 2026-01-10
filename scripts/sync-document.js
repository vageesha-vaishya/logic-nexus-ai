import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { diffLines } from 'diff';

// Load env vars
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Requires service role to bypass RLS or act as system

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncDocument(filePath, versionType = 'patch', notes = 'Sync from local file') {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const relativePath = path.relative(process.cwd(), fullPath);

  // Get document ID
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, current_version')
    .eq('path', relativePath)
    .single();

  if (docError && docError.code !== 'PGRST116') {
    console.error('Error fetching document:', docError);
    process.exit(1);
  }

  let docId = doc?.id;

  if (!docId) {
    console.log('Document not found in DB. Creating new record...');
    const { data: newDoc, error: createError } = await supabase
      .from('documents')
      .insert({
        path: relativePath,
        current_version: '1.0.0'
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating document:', createError);
      process.exit(1);
    }
    docId = newDoc.id;
    
    // Create initial version
    await createVersion(docId, '1.0.0', content, 'major', 'Initial import');
  } else {
    // Get latest version content to check if changed
    const { data: latestVersion } = await supabase
      .from('document_versions')
      .select('content, version')
      .eq('document_id', docId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestVersion && latestVersion.content === content) {
      console.log('No changes detected.');
      return;
    }

    // Calculate new version number
    let newVersion = '1.0.0';
    if (latestVersion) {
      const parts = latestVersion.version.split('.').map(Number);
      if (versionType === 'major') parts[0]++;
      else if (versionType === 'minor') parts[1]++;
      else parts[2]++;
      newVersion = parts.join('.');
    }

    await createVersion(docId, newVersion, content, versionType, notes, latestVersion?.content);
  }
}

async function createVersion(docId, version, content, type, notes, oldContent = '') {
  let diffSummary = null;
  if (oldContent) {
    const diff = diffLines(oldContent, content);
    diffSummary = {
      additions: diff.filter(p => p.added).length,
      deletions: diff.filter(p => p.removed).length,
      changes: diff.length
    };
  }

  const { error } = await supabase
    .from('document_versions')
    .insert({
      document_id: docId,
      version: version,
      content: content,
      change_type: type,
      change_notes: notes,
      diff_summary: diffSummary
    });

  if (error) {
    console.error('Error creating version:', error);
    process.exit(1);
  }

  await supabase
    .from('documents')
    .update({ current_version: version, updated_at: new Date() })
    .eq('id', docId);

  console.log(`Successfully synced version ${version}`);
}

// Usage: node scripts/sync-document.js <file_path> [major|minor|patch] [notes]
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: node scripts/sync-document.js <file_path> [major|minor|patch] [notes]');
  process.exit(0);
}

syncDocument(args[0], args[1], args[2]);
