import { describe, expect, it } from "vitest";
import { parseEmail } from "../utils/parser.ts";

/**
 * Builds a minimal, real RFC822 message as raw bytes: an ISO-8859-1-charset
 * text/plain body containing byte 0xE9 -- the ISO-8859-1 encoding of 'é'
 * (U+00E9). This is the same construction proven in ../utils/parser.test.ts.
 */
function buildIso88591Message(): Buffer {
  const headers =
    "From: sender@example.com\r\n" +
    "To: recipient@example.com\r\n" +
    "Subject: Test\r\n" +
    "Content-Type: text/plain; charset=iso-8859-1\r\n" +
    "Content-Transfer-Encoding: 8bit\r\n" +
    "\r\n";
  const headerBytes = Buffer.from(headers, "ascii");
  const bodyBytes = Buffer.from([0x63, 0x61, 0x66, 0xe9]); // "caf" + 0xE9
  return Buffer.concat([headerBytes, bodyBytes]);
}

function buildAsciiMessage(): Buffer {
  const headers =
    "From: sender@example.com\r\n" +
    "To: recipient@example.com\r\n" +
    "Subject: Test\r\n" +
    "Content-Type: text/plain; charset=us-ascii\r\n" +
    "Content-Transfer-Encoding: 7bit\r\n" +
    "\r\n";
  return Buffer.from(headers + "hello world", "ascii");
}

/**
 * Mirrors gmail.ts's own base64url -> base64 substitution
 * (msgData.raw.replace(/-/g, '+').replace(/_/g, '/')) in reverse, to build
 * a realistic `msgData.raw` value the way the real Gmail API sends it
 * (base64url: '+' -> '-', '/' -> '_').
 */
function toGmailBase64Url(message: Buffer): string {
  return message.toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * The exact decode this task's fix performs in gmail.ts's
 * saveGmailMessage: reverse the base64url substitution, then decode
 * directly to a Buffer.
 */
function decodeGmailBase64Url(rawBase64Url: string): Buffer {
  const rawBase64 = rawBase64Url.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(rawBase64, "base64");
}

describe("Gmail message decode pipeline", () => {
  it("decodes an ISO-8859-1 message end-to-end (base64url -> Buffer -> parseEmail) correctly", async () => {
    const original = buildIso88591Message();
    const gmailRaw = toGmailBase64Url(original);
    const bytes = decodeGmailBase64Url(gmailRaw);
    const result = await parseEmail(bytes);
    expect(result.bodyText).toBe("café");
  });

  it("decodes a plain ASCII message identically through the same pipeline", async () => {
    const original = buildAsciiMessage();
    const gmailRaw = toGmailBase64Url(original);
    const bytes = decodeGmailBase64Url(gmailRaw);
    const result = await parseEmail(bytes);
    expect(result.bodyText).toBe("hello world");
  });

  it("produces a byte-for-byte identical Buffer to the original message, independent of mailparser", () => {
    const original = buildIso88591Message();
    const gmailRaw = toGmailBase64Url(original);
    const bytes = decodeGmailBase64Url(gmailRaw);
    expect(bytes.equals(original)).toBe(true);
  });
});
