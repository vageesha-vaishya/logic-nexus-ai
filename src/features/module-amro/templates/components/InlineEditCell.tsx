/**
 * Inline Edit Cell Component
 * 
 * Features:
 * - Click to edit cell values directly in the grid
 * - Client-side validation with instant feedback
 * - Save/Cancel actions
 * - Conflict detection with optimistic UI
 * - Keyboard shortcuts (Enter to save, Escape to cancel)
 * - Full accessibility support
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WorkPackageTemplate } from '../AmroWorkPackageTemplatesPage';

// ── Types ──────────────────────────────────────────────────────────────────────

export type EditFieldType = 'text' | 'textarea' | 'select' | 'number' | 'date';

export interface InlineEditCellProps {
  // Cell configuration
  field: keyof WorkPackageTemplate;
  value: any;
  type: EditFieldType;
  
  // Validation
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  validate?: (value: any) => string | null; // Returns error message or null
  
  // Options (for select type)
  options?: Array<{ value: string; label: string }>;
  
  // Edit state
  isEditing: boolean;
  isSaving: boolean;
  hasConflict: boolean;
  
  // Callbacks
  onStartEdit: () => void;
  onSave: (value: any) => Promise<void>;
  onCancel: () => void;
  
  // Display
  placeholder?: string;
  renderValue?: (value: any) => React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InlineEditCell({
  field,
  value,
  type,
  required = false,
  maxLength,
  minLength,
  pattern,
  validate,
  options = [],
  isEditing,
  isSaving,
  hasConflict,
  onStartEdit,
  onSave,
  onCancel,
  placeholder,
  renderValue,
}: InlineEditCellProps) {
  const [editValue, setEditValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectRef = useRef<HTMLButtonElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing) {
      setEditValue(value);
      setError(null);
      setIsDirty(false);
      
      // Focus appropriate input
      const timeoutId = setTimeout(() => {
        if (type === 'textarea' && textareaRef.current) {
          textareaRef.current.focus();
        } else if (type === 'select' && selectRef.current) {
          selectRef.current.focus();
        } else if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isEditing, value, type]);

  // Validate value
  const validateValue = useCallback(
    (val: any): string | null => {
      // Required validation
      if (required && (!val || (typeof val === 'string' && val.trim() === ''))) {
        return `${field} is required`;
      }
      
      // Min length validation
      if (minLength && typeof val === 'string' && val.length < minLength) {
        return `${field} must be at least ${minLength} characters`;
      }
      
      // Max length validation
      if (maxLength && typeof val === 'string' && val.length > maxLength) {
        return `${field} must be at most ${maxLength} characters`;
      }
      
      // Pattern validation
      if (pattern && typeof val === 'string' && !pattern.test(val)) {
        return `${field} format is invalid`;
      }
      
      // Custom validation
      if (validate) {
        return validate(val);
      }
      
      return null;
    },
    [field, required, minLength, maxLength, pattern, validate]
  );

  // Handle value change
  const handleChange = useCallback(
    (newValue: any) => {
      setEditValue(newValue);
      setIsDirty(true);
      
      // Clear error when user starts typing
      if (error) {
        setError(null);
      }
    },
    [error]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    // Validate
    const validationError = validateValue(editValue);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    // Check if value changed
    if (!isDirty && editValue === value) {
      onCancel();
      return;
    }
    
    // Save
    try {
      await onSave(editValue);
    } catch (err: any) {
      if (err.message?.includes('CONFLICT')) {
        setError('Conflict: Another user modified this template. Please reload.');
      } else {
        setError(err.message || 'Failed to save changes');
      }
    }
  }, [editValue, isDirty, value, validateValue, onSave, onCancel]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setEditValue(value);
    setError(null);
    setIsDirty(false);
    onCancel();
  }, [value, onCancel]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  // Display mode
  if (!isEditing) {
    return (
      <div
        className="cursor-pointer hover:bg-muted/30 rounded px-2 py-1 -mx-2 transition-colors"
        onClick={onStartEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onStartEdit();
          }
        }}
        aria-label={`Edit ${field}. Current value: ${value || 'empty'}`}
        title="Click to edit"
      >
        {renderValue ? renderValue(value) : (
          <span className={value ? '' : 'text-muted-foreground'}>
            {value || '—'}
          </span>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="space-y-2">
      {/* Input field */}
      <div className="relative">
        {type === 'text' && (
          <Input
            ref={inputRef}
            value={editValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={isSaving}
            className={error ? 'border-destructive' : ''}
            aria-label={`${field} input`}
            aria-invalid={!!error}
            aria-describedby={error ? `${field}-error` : undefined}
          />
        )}
        
        {type === 'textarea' && (
          <Textarea
            ref={textareaRef}
            value={editValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={isSaving}
            className={`min-h-[80px] ${error ? 'border-destructive' : ''}`}
            aria-label={`${field} textarea`}
            aria-invalid={!!error}
            aria-describedby={error ? `${field}-error` : undefined}
          />
        )}
        
        {type === 'select' && (
          <Select
            value={editValue || ''}
            onValueChange={handleChange}
            disabled={isSaving}
          >
            <SelectTrigger
              ref={selectRef}
              className={error ? 'border-destructive' : ''}
              aria-label={`${field} select`}
              aria-invalid={!!error}
            >
              <SelectValue placeholder={placeholder || `Select ${field}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {type === 'number' && (
          <Input
            ref={inputRef}
            type="number"
            value={editValue || ''}
            onChange={(e) => handleChange(e.target.value ? Number(e.target.value) : null)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isSaving}
            className={error ? 'border-destructive' : ''}
            aria-label={`${field} number input`}
            aria-invalid={!!error}
            aria-describedby={error ? `${field}-error` : undefined}
          />
        )}
        
        {type === 'date' && (
          <Input
            ref={inputRef}
            type="date"
            value={editValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isSaving}
            className={error ? 'border-destructive' : ''}
            aria-label={`${field} date input`}
            aria-invalid={!!error}
            aria-describedby={error ? `${field}-error` : undefined}
          />
        )}
        
        {/* Character count */}
        {maxLength && typeof editValue === 'string' && (
          <p className="text-xs text-muted-foreground text-right mt-1">
            {editValue.length}/{maxLength}
          </p>
        )}
      </div>
      
      {/* Error message */}
      {error && (
        <div
          id={`${field}-error`}
          className="flex items-center gap-2 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
      
      {/* Conflict warning */}
      {hasConflict && (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <AlertCircle className="w-4 h-4" />
          <span>Conflict detected. Please reload to see latest changes.</span>
        </div>
      )}
      
      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || !!error}
          className="h-7"
          aria-label="Save changes"
        >
          {isSaving ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Saving...
            </>
          ) : (
            <>
              <Check className="w-3 h-3 mr-1" />
              Save
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSaving}
          className="h-7"
          aria-label="Cancel editing"
        >
          <X className="w-3 h-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
