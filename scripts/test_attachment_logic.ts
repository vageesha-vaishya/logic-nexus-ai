
// Mock Supabase Client
const mockSupabase = {
  storage: {
    from: (bucket) => ({
      download: async (path) => {
        if (path === 'valid.pdf') {
            const content = 'JVBERi0xLjcK...'; // Minimal PDF header
            return { data: { arrayBuffer: async () => new TextEncoder().encode(content).buffer }, error: null };
        }
        if (path === 'empty.pdf') {
            return { data: { arrayBuffer: async () => new ArrayBuffer(0) }, error: null };
        }
        if (path === 'error.pdf') {
            return { data: null, error: { message: 'Download failed' } };
        }
        return { data: null, error: { message: 'File not found' } };
      }
    })
  }
};

// Copied Logic from send-email/index.ts
async function prepareAttachments(supabase, attachments) {
  if (!attachments || attachments.length === 0) return [];
  
  console.log(`Processing ${attachments.length} attachments...`);
  const processed = [];
  
  for (const att of attachments) {
    try {
      let content = att.content;
      
      // Validation: Check for required fields
      if (!att.filename) {
        console.warn("Attachment missing filename, skipping.");
        continue;
      }

      if (att.path) {
        console.log(`Downloading attachment from storage: ${att.path}`);
        const { data, error } = await supabase.storage
          .from('email-attachments')
          .download(att.path);
          
        if (error) {
          console.error(`Failed to download attachment ${att.path}:`, error);
          continue;
        }
        
        if (!data) {
             console.error(`Download returned no data for ${att.path}`);
             continue;
        }

        const buffer = await data.arrayBuffer();
        if (buffer.byteLength === 0) {
            console.warn(`Attachment ${att.filename} is empty (0 bytes).`);
        }
        // Mock btoa for Node environment if needed, but in this script we are just testing logic flow
        // In Node, btoa might not be available in older versions, but we can use Buffer
        content = Buffer.from(buffer).toString('base64');
      }

      // Final Validation of content
      if (!content) {
        console.warn(`Attachment ${att.filename} has no content, skipping.`);
        continue;
      }
      
      // Size check (e.g. 10MB limit)
      const sizeInBytes = (content.length * 3) / 4; // Approx base64 size
      if (sizeInBytes > 10 * 1024 * 1024) {
          console.warn(`Attachment ${att.filename} exceeds 10MB limit (${(sizeInBytes / 1024 / 1024).toFixed(2)}MB).`);
      }

      // PDF Specific Verification
      if (att.contentType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf')) {
          if (!content.startsWith('JVBERi0')) { // JVBERi0 is 'base64("%PDF-")'
              console.warn(`Attachment ${att.filename} is marked as PDF but content does not look like a PDF header.`);
          } else {
              console.log(`Verified PDF header for ${att.filename}`);
          }
      }

      processed.push({
        filename: att.filename,
        contentType: att.contentType || 'application/octet-stream',
        content: content
      });
      console.log(`Attachment processed: ${att.filename} (${(content.length * 3 / 4 / 1024).toFixed(2)} KB)`);
      
    } catch (err) {
      console.error(`Error processing attachment ${att.filename}:`, err);
    }
  }
  return processed;
}

// Test Runner
async function runTests() {
    console.log('--- Running Attachment Logic Tests ---');

    // Test 1: Valid Base64 PDF
    console.log('\nTest 1: Valid Base64 PDF');
    const validPDF = "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQK";
    const res1 = await prepareAttachments(mockSupabase, [{
        filename: 'test1.pdf',
        content: validPDF,
        contentType: 'application/pdf'
    }]);
    console.log('Result 1:', res1.length === 1 ? 'PASS' : 'FAIL');

    // Test 2: Invalid PDF Header
    console.log('\nTest 2: Invalid PDF Header');
    const invalidPDF = Buffer.from("Not a PDF").toString('base64');
    const res2 = await prepareAttachments(mockSupabase, [{
        filename: 'test2.pdf',
        content: invalidPDF,
        contentType: 'application/pdf'
    }]);
    console.log('Result 2 (Should warn):', res2.length === 1 ? 'PASS (Allowed but warned)' : 'FAIL');

    // Test 3: Missing Filename
    console.log('\nTest 3: Missing Filename');
    const res3 = await prepareAttachments(mockSupabase, [{
        content: validPDF,
        contentType: 'application/pdf'
    }]);
    console.log('Result 3:', res3.length === 0 ? 'PASS' : 'FAIL');

    // Test 4: Empty Content
    console.log('\nTest 4: Empty Content');
    const res4 = await prepareAttachments(mockSupabase, [{
        filename: 'test4.pdf',
        content: '',
        contentType: 'application/pdf'
    }]);
    console.log('Result 4:', res4.length === 0 ? 'PASS' : 'FAIL');

    // Test 5: Large File (Mocked)
    console.log('\nTest 5: Large File Warning');
    const largeContent = Buffer.alloc(11 * 1024 * 1024).toString('base64'); // 11MB
    const res5 = await prepareAttachments(mockSupabase, [{
        filename: 'large.pdf',
        content: largeContent,
        contentType: 'application/pdf'
    }]);
    console.log('Result 5 (Should warn):', res5.length === 1 ? 'PASS' : 'FAIL');

}

runTests().catch(console.error);
