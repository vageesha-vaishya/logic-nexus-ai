import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Advanced text matching helper for filter operators
export type TextOp = "contains" | "equals" | "startsWith" | "endsWith";

export function matchText(
  value: string | null | undefined,
  query: string,
  op: TextOp = "contains"
): boolean {
  if (!query) return true;
  const val = (value ?? "").toLowerCase();
  const q = query.toLowerCase();
  switch (op) {
    case "equals":
      return val === q;
    case "startsWith":
      return val.startsWith(q);
    case "endsWith":
      return val.endsWith(q);
    case "contains":
    default:
      return val.includes(q);
  }
}

export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(value);
}
