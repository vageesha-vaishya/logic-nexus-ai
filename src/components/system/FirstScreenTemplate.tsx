import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ViewToggle, ViewMode } from "@/components/ui/view-toggle";
import { FileDown, FileUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/**
 * A single breadcrumb item displayed in the page header.
 * @property label Visible text for the breadcrumb
 * @property to Optional href for navigable crumb; last crumb typically omits
 */
type Crumb = { label: string; to?: string };

/**
 * Props for FirstScreenTemplate, a standardized header + actions layout
 * for first/index screens that support multiple view modes and file ops.
 * @property title Page title displayed prominently
 * @property description Optional subtitle or helper text under the title
 * @property breadcrumbs Optional navigation trail for the current location
 * @property className Optional container className for outer wrapper
 * @property viewMode Current view mode (list, card, grid)
 * @property onViewModeChange Callback when view mode is changed
 * @property availableModes Optional list of modes to render in toggle
 * @property onImport Handler for Import button; hides if undefined
 * @property onExport Handler for Export button; hides if undefined
 * @property onCreate Handler for New button; hides if undefined
 * @property actionsRight Optional custom actions injected to the right side
 * @property children Main content area rendered below the header
 */
interface FirstScreenTemplateProps {
  /**
   * The main title of the page or section.
   */
  title: string;
  /**
   * Optional description text displayed below the title.
   */
  description?: string;
  /**
   * Array of breadcrumb items to display navigation hierarchy.
   */
  breadcrumbs?: Crumb[];
  /**
   * Optional CSS class names for the container.
   */
  className?: string;
  /**
   * Current view mode (list, card, grid, pipeline, etc.).
   */
  viewMode?: ViewMode;
  /**
   * Callback fired when the view mode changes.
   */
  onViewModeChange?: (value: ViewMode) => void;
  /**
   * Array of available view modes to show in the toggle.
   */
  availableModes?: ViewMode[];
  /**
   * Callback fired when the Import button is clicked. If not provided, the button is hidden.
   */
  onImport?: () => void;
  /**
   * Callback fired when the Export button is clicked. If not provided, the button is hidden.
   */
  onExport?: () => void;
  /**
   * Callback fired when the New/Create button is clicked. If not provided, the button is hidden.
   */
  onCreate?: () => void;
  /**
   * Additional actions or elements to render on the right side of the header.
   */
  actionsRight?: ReactNode;
  /**
   * The main content to render (e.g., the list, grid, or empty state).
   */
  children: ReactNode;
}

export function FirstScreenTemplate({
  title,
  description,
  breadcrumbs,
  className,
  viewMode = "list",
  onViewModeChange,
  availableModes,
  onImport,
  onExport,
  onCreate,
  actionsRight,
  children,
}: FirstScreenTemplateProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((c, i) => (
                  <BreadcrumbItem key={`${c.label}-${i}`}>
                    {c.to ? (
                      <>
                        <BreadcrumbLink href={c.to}>{c.label}</BreadcrumbLink>
                        {i !== breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                      </>
                    ) : (
                      <BreadcrumbPage>{c.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          )}
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            {description && <p className="text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onViewModeChange && (
            <ViewToggle value={viewMode} onChange={onViewModeChange} modes={availableModes} />
          )}
          {onImport && (
            <Button variant="outline" onClick={onImport}>
              <FileUp className="mr-2 h-4 w-4" />
              Import
            </Button>
          )}
          {onExport && (
            <Button variant="outline" onClick={onExport}>
              <FileDown className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
          {onCreate && (
            <Button onClick={onCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New
            </Button>
          )}
          {actionsRight}
        </div>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
