// @ts-ignore
import { assertEquals, assertRejects } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { processTemplate } from "./index.ts";

declare const Deno: any;

// Mock Supabase Client
const mockSupabase = (templateData: any, error: any = null) => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: templateData, error }),
      }),
    }),
  }),
});

Deno.test("processTemplate - basic replacement", async () => {
  const mock = mockSupabase({
    subject: "Hello {{name}}",
    body_html: "<p>Welcome {{name}} to {{company}}</p>",
  });

  const result = await processTemplate(mock as any, "tmpl_123", {
    name: "John",
    company: "Acme",
  });

  assertEquals(result.subject, "Hello John");
  assertEquals(result.body, "<p>Welcome John to Acme</p>");
});

Deno.test("processTemplate - missing variables", async () => {
  const mock = mockSupabase({
    subject: "Hello {{name}}",
    body_text: "Welcome",
  });

  const result = await processTemplate(mock as any, "tmpl_123", {});
  // Should keep the placeholder if not replaced?
  // Current implementation replaces with value if key exists in variables map.
  // If map is empty, loop doesn't run.
  assertEquals(result.subject, "Hello {{name}}");
});

Deno.test("processTemplate - template not found", async () => {
  const mock = mockSupabase(null, { message: "Row not found" });
  await assertRejects(
    async () => await processTemplate(mock as any, "tmpl_missing"),
    Error,
    "Template not found"
  );
});
