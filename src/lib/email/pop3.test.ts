import { describe, it, expect } from "vitest";
import { shouldDeleteAfterFetch } from "./pop3";

describe("POP3 delete policy behavior", () => {
  it("returns false for keep", () => {
    expect(shouldDeleteAfterFetch("keep")).toBe(false);
  });

  it("returns true for delete_after_fetch", () => {
    expect(shouldDeleteAfterFetch("delete_after_fetch")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(shouldDeleteAfterFetch("DELETE_AFTER_FETCH")).toBe(true);
    expect(shouldDeleteAfterFetch("Keep")).toBe(false);
  });

  it("handles undefined or empty values", () => {
    expect(shouldDeleteAfterFetch(undefined)).toBe(false);
    expect(shouldDeleteAfterFetch("")).toBe(false);
  });
});

