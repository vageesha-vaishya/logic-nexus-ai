import * as React from "react";

import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn(
          "w-full caption-bottom text-sm border-collapse bg-[hsl(var(--table-background))] text-[hsl(var(--table-foreground))]",
          className,
        )}
        {...props}
      />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(
        "bg-[hsl(var(--table-header-background))] border-y border-[hsl(var(--table-header-separator))] [&_th]:text-[hsl(var(--table-header-text))] [&_th]:border-l [&_th]:border-[hsl(var(--table-header-separator))] [&_th:first-child]:border-l-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-all hover:bg-muted/50 hover:shadow-sm data-[state=selected]:bg-muted cursor-pointer", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-11 px-4 text-left align-middle font-semibold text-sm text-foreground/70 bg-muted/30 border-b [&:has([role=checkbox])]:pr-0 first:rounded-tl-md last:rounded-tr-md",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("p-4 align-middle text-sm [&:has([role=checkbox])]:pr-0", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

interface SortableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  field: string;
  activeField?: string;
  direction?: "asc" | "desc";
  onSort: (field: string, multi?: boolean) => void;
  label?: React.ReactNode;
  sortOrder?: number;
  isActive?: boolean;
}

const SortableHead = React.forwardRef<HTMLTableCellElement, SortableHeadProps>(
  ({ className, field, activeField, direction = "asc", onSort, label, children, sortOrder, isActive: propIsActive, ...props }, ref) => {
    const isActive = propIsActive !== undefined ? propIsActive : activeField === field;
    const ariaSort = isActive ? (direction === "asc" ? "ascending" : "descending") : "none";
    
    return (
      <TableHead ref={ref as any} className={cn("select-none", className)} aria-sort={ariaSort} {...props}>
        <button
          type="button"
          className="flex items-center gap-2 w-full text-left hover:opacity-80 group"
          onClick={(e) => onSort(field, e.shiftKey)}
          title={isActive ? (direction === "asc" ? "Sorted ascending" : "Sorted descending") : "Click to sort (Shift+Click for multi-sort)"}
        >
          <span className="truncate">{label ?? children}</span>
          <span className="inline-flex items-center gap-1">
            {isActive ? (
              <>
                {direction === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {sortOrder && <span className="text-[10px] font-medium opacity-70">{sortOrder}</span>}
              </>
            ) : (
              <ChevronsUpDown className="h-4 w-4 opacity-0 group-hover:opacity-40 transition-opacity" />
            )}
          </span>
        </button>
      </TableHead>
    );
  },
);
SortableHead.displayName = "SortableHead";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption, SortableHead };
