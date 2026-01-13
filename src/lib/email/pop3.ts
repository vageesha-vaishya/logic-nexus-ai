export type Pop3DeletePolicy = "keep" | "delete_after_fetch";

export function shouldDeleteAfterFetch(policy?: Pop3DeletePolicy | string): boolean {
  const value = String(policy || "").toLowerCase().trim();
  return value === "delete_after_fetch";
}

