import { describe, it, expect } from "vitest";
import type { LeadFormData } from "@/components/crm/LeadForm";
import { sanitizeLeadDataForInsert, extractEmailAddress } from "./email-to-lead-helpers";

describe("sanitizeLeadDataForInsert", () => {
  it("removes attachments and service_id fields before insert", () => {
    const input = {
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "",
      status: "new",
      source: "email",
      attachments: [{ name: "file.pdf" }],
      service_id: "service-123",
    } as LeadFormData;

    const result = sanitizeLeadDataForInsert(input);

    expect(result).not.toHaveProperty("attachments");
    expect(result).not.toHaveProperty("service_id");
    expect(result.first_name).toBe("John");
    expect(result.last_name).toBe("Doe");
    expect(result.email).toBe("john@example.com");
  });
});

describe("extractEmailAddress", () => {
  it("extracts email from 'Name <email>' format", () => {
    expect(extractEmailAddress("John Doe <John.Doe@Example.com>")).toBe("john.doe@example.com");
  });

  it("extracts email from '<email>' format", () => {
    expect(extractEmailAddress("<USER@Example.com>")).toBe("user@example.com");
  });

  it("returns normalized email when input is plain email", () => {
    expect(extractEmailAddress(" Test@Example.com ")).toBe("test@example.com");
  });

  it("returns null for invalid email strings", () => {
    expect(extractEmailAddress("not-an-email")).toBeNull();
  });
});
