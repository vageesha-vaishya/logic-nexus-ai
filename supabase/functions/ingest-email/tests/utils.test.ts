import { describe, it, expect, vi } from 'vitest';
import { parseAddress, normalizeGmailPayload, normalizeOutlookPayload, correlateThread, NormalizedEmail } from '../utils.ts';

describe('Email Utils', () => {
  describe('parseAddress', () => {
    it('parses "Name <email>" correctly', () => {
      expect(parseAddress('John Doe <john@example.com>')).toEqual({
        name: 'John Doe',
        email: 'john@example.com'
      });
    });

    it('parses "<email>" correctly', () => {
      expect(parseAddress('<john@example.com>')).toEqual({
        email: 'john@example.com'
      });
    });

    it('parses "email" correctly', () => {
      expect(parseAddress('john@example.com')).toEqual({
        email: 'john@example.com'
      });
    });
  });

  describe('normalizeGmailPayload', () => {
    it('normalizes basic Gmail payload', () => {
      const payload = {
        id: "msg-123",
        threadId: "thread-123",
        snippet: "Hello world",
        internalDate: "1672531200000",
        payload: {
          headers: [
            { name: "From", value: "Sender <sender@example.com>" },
            { name: "To", value: "Receiver <receiver@example.com>" },
            { name: "Subject", value: "Test Email" },
            { name: "Message-ID", value: "<msg-123@example.com>" },
          ],
          parts: []
        }
      };
      const result = normalizeGmailPayload(payload);
      expect(result.provider).toBe('gmail');
      expect(result.messageId).toBe('<msg-123@example.com>');
      expect(result.subject).toBe('Test Email');
      expect(result.from).toEqual({ name: 'Sender', email: 'sender@example.com' });
      expect(result.attachments).toEqual([]);
    });

    it('extracts Gmail attachments', () => {
        const payload = {
          id: "msg-att",
          payload: {
            headers: [],
            parts: [
              {
                filename: "test.txt",
                mimeType: "text/plain",
                body: {
                  data: "SGVsbG8=", // Hello
                  size: 5
                }
              },
              {
                mimeType: "multipart/alternative",
                parts: [
                  {
                    filename: "image.png",
                    mimeType: "image/png",
                    body: {
                      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", // 1x1 pixel
                      size: 68
                    }
                  }
                ]
              }
            ]
          }
        };
        const result = normalizeGmailPayload(payload);
        expect(result.attachments).toHaveLength(2);
        expect(result.attachments[0].filename).toBe("test.txt");
        // Check URL safe replacement if needed, but here simple base64
        expect(result.attachments[1].filename).toBe("image.png");
    });
  });

  describe('normalizeOutlookPayload', () => {
      it('normalizes Outlook payload with attachments', () => {
          const payload = {
              id: "msg-out",
              internetMessageId: "<msg-out@example.com>",
              subject: "Outlook Test",
              from: { emailAddress: { name: "Sender", address: "sender@example.com" } },
              attachments: [
                  {
                      name: "doc.pdf",
                      contentType: "application/pdf",
                      contentBytes: "JVBERi0xLjQK...",
                      size: 1000
                  }
              ]
          };
          const result = normalizeOutlookPayload(payload);
          expect(result.provider).toBe('outlook');
          expect(result.attachments).toHaveLength(1);
          expect(result.attachments[0].filename).toBe("doc.pdf");
          expect(result.attachments[0].content).toBe("JVBERi0xLjQK...");
      });
  });

  describe('correlateThread', () => {
    const mockLookup = vi.fn();

    it('returns new conversation ID if no correlation found', async () => {
      mockLookup.mockResolvedValue(null);
      const email = {
        inReplyTo: undefined,
        references: []
      } as unknown as NormalizedEmail;

      const result = await correlateThread(email, mockLookup);
      expect(result.parentEmailId).toBeNull();
      expect(result.conversationId).toBeDefined();
    });

    it('correlates via In-Reply-To', async () => {
      const parentId = 'parent-123';
      const convId = 'conv-abc';
      mockLookup.mockResolvedValue({ id: parentId, conversation_id: convId });
      
      const email = {
        inReplyTo: '<parent@example.com>',
        references: []
      } as unknown as NormalizedEmail;

      const result = await correlateThread(email, mockLookup);
      expect(mockLookup).toHaveBeenCalledWith('<parent@example.com>');
      expect(result.parentEmailId).toBe(parentId);
      expect(result.conversationId).toBe(convId);
    });

    it('correlates via References if In-Reply-To misses', async () => {
        const parentId = 'ref-123';
        const convId = 'conv-xyz';
        
        // First call for In-Reply-To returns null
        // Second call for Reference returns match
        mockLookup
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: parentId, conversation_id: convId });

        const email = {
          inReplyTo: '<missing@example.com>',
          references: ['<root@example.com>', '<ref@example.com>']
        } as unknown as NormalizedEmail;
  
        const result = await correlateThread(email, mockLookup);
        expect(mockLookup).toHaveBeenCalledWith('<missing@example.com>');
        expect(mockLookup).toHaveBeenCalledWith('<ref@example.com>');
        expect(result.parentEmailId).toBe(parentId);
        expect(result.conversationId).toBe(convId);
    });
  });
});
