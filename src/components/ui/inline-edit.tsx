import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { z } from "zod";

interface InlineEditProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  multiline?: boolean;
  validation?: z.ZodString;
  className?: string;
  placeholder?: string;
  maxLength?: number;
}

export function InlineEdit({
  value,
  onSave,
  multiline = false,
  validation,
  className,
  placeholder = "Enter value...",
  maxLength = 500,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    setError(null);

    // Validate
    if (validation) {
      try {
        validation.parse(editValue);
      } catch (err) {
        if (err instanceof z.ZodError) {
          setError(err.errors[0]?.message || "Invalid input");
          return;
        }
      }
    }

    setSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setError(null);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div
        className={cn(
          "group flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/50 cursor-pointer transition-colors",
          className
        )}
        onClick={() => setIsEditing(true)}
      >
        <span className={cn("flex-1", !value && "text-muted-foreground italic")}>
          {value || placeholder}
        </span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-start gap-2">
        {multiline ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[60px]"
            maxLength={maxLength}
            disabled={saving}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            maxLength={maxLength}
            disabled={saving}
          />
        )}
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-success"
            onClick={handleSave}
            disabled={saving}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            onClick={handleCancel}
            disabled={saving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
