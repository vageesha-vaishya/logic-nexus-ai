export function sanitizeForLLM(text: string): { sanitized: string; redacted: string[] } {
  const redacted: string[] = [];
  let sanitized = text || "";

  sanitized = sanitized.replace(/\b[\w.-]+@[\w.-]+\.\w{2,4}\b/g, () => {
    redacted.push("email");
    return "[EMAIL]";
  });

  sanitized = sanitized.replace(
    /\b(?:\+?\d{1,3}[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/g,
    () => {
      redacted.push("phone");
      return "[PHONE]";
    }
  );

  sanitized = sanitized.replace(/\b(?:\d[ -]*?){13,16}\b/g, () => {
    redacted.push("card");
    return "[CARD]";
  });

  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, () => {
    redacted.push("ssn");
    return "[SSN]";
  });

  sanitized = sanitized.replace(/\b[A-Z]{1,2}\d{6,9}\b/g, () => {
    redacted.push("passport");
    return "[PASSPORT]";
  });

  return { sanitized, redacted };
}
