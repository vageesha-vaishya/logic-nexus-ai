import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditableTextProps {
  value: string | number;
  onSave: (value: string | number) => Promise<void> | void;
  type?: "text" | "number" | "currency";
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  currencySymbol?: string;
}

export function EditableText({
  value: initialValue,
  onSave,
  type = "text",
  className,
  inputClassName,
  placeholder = "Click to edit",
  currencySymbol = "$",
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState<string | number>(initialValue);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type !== "number") {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  const handleSave = async () => {
    if (value === initialValue) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    try {
      await onSave(type === "number" || type === "currency" ? Number(value) : value);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save", error);
      // Optional: Toast error here or let parent handle it
      setValue(initialValue); // Revert on error
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setValue(initialValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 w-full relative group">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={loading}
          type={type === "number" || type === "currency" ? "number" : "text"}
          className={cn(
            "h-7 py-1 px-2 text-sm bg-background border-primary/50 shadow-sm focus-visible:ring-1",
            inputClassName
          )}
          autoFocus
        />
        {/* Buttons are optional/hidden since we save on blur, 
            but good for accessibility or explicit action if needed. 
            For inline-edit usually Enter/Blur is enough. */}
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        "cursor-text hover:bg-muted/50 rounded px-1 -mx-1 border border-transparent hover:border-border/40 transition-colors truncate min-h-[1.2em]",
        className
      )}
      title="Click to edit"
    >
      {type === "currency" && currencySymbol}
      {type === "currency" ? Number(value).toLocaleString() : value || placeholder}
    </div>
  );
}
