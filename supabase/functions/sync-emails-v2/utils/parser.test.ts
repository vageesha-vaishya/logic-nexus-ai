import { describe, expect, it } from "vitest";
import { parseEmail } from "./parser.ts";

/**
 * Builds a minimal, real RFC822 message as raw bytes: an ISO-8859-1-charset
 * text/plain body containing byte 0xE9 -- the ISO-8859-1 encoding of the
 * character 'é' (LATIN SMALL LETTER E WITH ACUTE, U+00E9). This is NOT the
 * UTF-8 encoding of 'é' (which is the two bytes 0xC3 0xA9) -- that
 * distinction is the entire point of this test.
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

describe("parseEmail charset handling", () => {
  it("correctly decodes an ISO-8859-1 body when given the raw message bytes directly", async () => {
    const raw = buildIso88591Message();
    const result = await parseEmail(raw);
    expect(result.bodyText).toBe("café");
  });

  it("produces corrupted text if the raw bytes are stringified as UTF-8 first (the exact bug this fix removes)", async () => {
    const raw = buildIso88591Message();
    // Reproduces exactly what the old buggy imap.ts code did: Buffer.toString()
    // with no argument performs an implicit UTF-8 decode before the MIME
    // parser ever sees the bytes -- byte 0xE9 alone is not valid UTF-8.
    const corruptedString = raw.toString();
    const result = await parseEmail(corruptedString);
    expect(result.bodyText).not.toBe("café");
  });

  it("decodes identically whether given a Buffer or a string, for plain ASCII content", async () => {
    const raw = buildAsciiMessage();
    const viaBuffer = await parseEmail(raw);
    const viaString = await parseEmail(raw.toString());
    expect(viaBuffer.bodyText).toBe("hello world");
    expect(viaString.bodyText).toBe("hello world");
  });
});
