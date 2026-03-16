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
  lead_type: "standard" as const,
  referral_name: "",
  decision_timeline: "",
  stakeholders_count: "",
  lost_reason: "",
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

  it("requires referral name when source is referral", () => {
    const result = leadSchema.safeParse({
      ...baseLead,
      expected_close_date: "2026-01-15",
      source: "referral",
      referral_name: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.formErrors.fieldErrors.referral_name || [];
      expect(errors).toContain("Referral name is required when source is Referral");
    }
  });

  it("requires loss reason when status is lost", () => {
    const result = leadSchema.safeParse({
      ...baseLead,
      expected_close_date: "2026-01-15",
      status: "lost",
      lost_reason: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.formErrors.fieldErrors.lost_reason || [];
      expect(errors).toContain("Loss reason is required when lead status is Lost");
    }
  });

  it("requires enterprise stakeholders count", () => {
    const result = leadSchema.safeParse({
      ...baseLead,
      expected_close_date: "2026-01-15",
      lead_type: "enterprise",
      stakeholders_count: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.formErrors.fieldErrors.stakeholders_count || [];
      expect(errors).toContain("Stakeholders count is required for enterprise leads");
    }
  });

  it("requires value for proposal stage", () => {
    const result = leadSchema.safeParse({
      ...baseLead,
      expected_close_date: "2026-01-15",
      status: "proposal",
      estimated_value: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.formErrors.fieldErrors.estimated_value || [];
      expect(errors).toContain("Estimated value is required for this lead stage/type");
    }
  });
});
