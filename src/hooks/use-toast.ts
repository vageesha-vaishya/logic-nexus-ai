import * as React from "react";
import { toast as sonnerToast } from "sonner";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

// Compatibility layer for useToast to use sonner under the hood
function toast({ title, description, action, ...props }: Omit<ToasterToast, "id">) {
  const id = Math.random().toString(36).substring(2, 9);

  // Map shadcn toast to sonner
  if (props.variant === "destructive") {
    sonnerToast.error(title as string, {
      description: description as string,
      action: action ? {
        label: "Action",
        onClick: () => {} // Sonner action handling differs
      } : undefined,
    });
  } else {
    sonnerToast(title as string, {
      description: description as string,
      action: action ? {
        label: "Action",
        onClick: () => {}
      } : undefined,
    });
  }

  return {
    id,
    dismiss: () => sonnerToast.dismiss(id),
    update: () => {}, // Sonner update handling differs
  };
}

function useToast() {
  return {
    toasts: [], // No longer needed as sonner handles state internally
    toast,
    dismiss: (toastId?: string) => sonnerToast.dismiss(toastId),
  };
}

export { useToast, toast };
