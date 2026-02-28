// @ts-ignore
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
// @ts-ignore
import { parseAddress, normalizeGmailPayload, normalizeOutlookPayload } from "../utils.ts";

declare const Deno: any;

Deno.test("parseAddress - full format", () => {
  const result = parseAddress("John Doe <john@example.com>");
  assertEquals(result, { name: "John Doe", email: "john@example.com" });
});

Deno.test("parseAddress - email only", () => {
  const result = parseAddress("john@example.com");
  assertEquals(result, { email: "john@example.com" });
});

Deno.test("parseAddress - with quotes", () => {
  const result = parseAddress('"Doe, John" <john@example.com>');
  assertEquals(result, { name: "Doe, John", email: "john@example.com" });
});

Deno.test("normalizeGmailPayload - basic", () => {
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
      ]
    }
  };

  const result = normalizeGmailPayload(payload);
  assertEquals(result.provider, "gmail");
  assertEquals(result.messageId, "<msg-123@example.com>");
  assertEquals(result.threadId, "thread-123");
  assertEquals(result.subject, "Test Email");
  assertEquals(result.from, { name: "Sender", email: "sender@example.com" });
  assertEquals(result.to, [{ name: "Receiver", email: "receiver@example.com" }]);
  assertEquals(result.bodyText, "Hello world");
  assertEquals(result.receivedAt.getTime(), 1672531200000);
});

Deno.test("normalizeOutlookPayload - basic", () => {
  const payload = {
    id: "msg-outlook-123",
    internetMessageId: "<outlook-123@example.com>",
    conversationId: "conv-123",
    subject: "Outlook Test",
    receivedDateTime: "2023-01-01T00:00:00Z",
    from: {
      emailAddress: { name: "Outlook Sender", address: "sender@outlook.com" }
    },
    toRecipients: [
      { emailAddress: { name: "Outlook Receiver", address: "receiver@outlook.com" } }
    ],
    body: {
      contentType: "html",
      content: "<p>Hello Outlook</p>"
    }
  };

  const result = normalizeOutlookPayload(payload);
  assertEquals(result.provider, "outlook");
  assertEquals(result.messageId, "<outlook-123@example.com>");
  assertEquals(result.threadId, "conv-123");
  assertEquals(result.subject, "Outlook Test");
  assertEquals(result.from, { name: "Outlook Sender", email: "sender@outlook.com" });
  assertEquals(result.bodyHtml, "<p>Hello Outlook</p>");
  assertEquals(result.receivedAt.toISOString(), "2023-01-01T00:00:00.000Z");
});
