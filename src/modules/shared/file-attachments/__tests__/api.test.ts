import { describe, expect, it } from 'vitest';
import { DEFAULT_ATTACHMENT_POLICY, validateAttachment, validateAttachmentDescriptor } from '../api';

function mockFile(name: string, type: string, size: number): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe('file attachment validation', () => {
  it('accepts file within allowed type and size', () => {
    const file = mockFile('sample.pdf', 'application/pdf', 1024);
    const result = validateAttachment(file, DEFAULT_ATTACHMENT_POLICY);
    expect(result.valid).toBe(true);
  });

  it('rejects unsupported mime type', () => {
    const file = mockFile('script.js', 'text/javascript', 1024);
    const result = validateAttachment(file, DEFAULT_ATTACHMENT_POLICY);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Unsupported file type');
  });

  it('rejects file above max size', () => {
    const policy = { ...DEFAULT_ATTACHMENT_POLICY, maxBytes: 100 };
    const file = mockFile('oversize.pdf', 'application/pdf', 101);
    const result = validateAttachment(file, policy);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('exceeds');
  });

  it('validates mobile descriptor without browser File object dependency', () => {
    const result = validateAttachmentDescriptor(
      { name: 'mobile-image.jpg', mimeType: 'image/jpeg', sizeBytes: 2048 },
      DEFAULT_ATTACHMENT_POLICY,
    );
    expect(result.valid).toBe(true);
  });
});
