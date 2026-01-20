import { describe, it, expect } from "vitest";
import { leadSchema } from "./LeadForm";

const baseLead = {
  first_name: "John",
  last_name: "Doe",
  company: "",
  title: "",
  email: "john@example.com",
  phone: "",
  status: "new" as const,
  source: "email" as const,
  estimated_value: "",
  description: "",
  notes: "",
  tenant_id: "tenant-1",
  franchise_id: "",
  service_id: "Sea Freight",
  attachments: [] as any[],
};

describe("leadSchema expected_close_date validation", () => {
  it("fails when expected_close_date is empty", () => {
    const result = leadSchema.safeParse({
      ...baseLead,
      expected_close_date: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.formErrors.fieldErrors.expected_close_date || [];
      expect(errors).toContain("Expected Close Date is required");
    }
  });

  it("passes when expected_close_date is provided", () => {
    const result = leadSchema.safeParse({
      ...baseLead,
      expected_close_date: "2026-01-15",
    });

    expect(result.success).toBe(true);
  });
});
