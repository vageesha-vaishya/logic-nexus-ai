/**
 * AMRO Split View Component
 *
 * Responsive split-view layout with:
 * - Left: Data grid (flexible width)
 * - Right: Form/detail panel (30-40% width, resizable)
 * - Desktop: Side-by-side panels
 * - Mobile: Bottom sheet / full-screen modal overlay
 *
 * Features:
 * - Smooth transitions between layout modes
 * - Resizable panel divider on desktop
 * - Maintain grid state during transitions
 * - Close button on panel
 * - Backdrop overlay on mobile
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  PanelRightClose,
  PanelRightOpen,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useGridLayout, type GridLayoutMode } from './useGridLayout';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AmroSplitViewProps {
  /** Grid component/content */
  grid: React.ReactNode;
  /** Panel component/content */
  panel: React.ReactNode;
  /** Panel title */
  panelTitle?: string;
  /** Panel description */
  panelDescription?: string;
  /** Current layout mode */
  layoutMode?: GridLayoutMode;
  /** Is panel open */
  isPanelOpen?: boolean;
  /** Panel width percentage */
  panelWidth?: number;
  /** On layout mode change */
  onLayoutModeChange?: (mode: GridLayoutMode) => void;
  /** On panel close */
  onPanelClose?: () => void;
  /** On panel resize */
  onPanelResize?: (width: number) => void;
  /** CSS class name */
  className?: string;
  /** Layout configuration */
  layoutConfig?: ReturnType<typeof useGridLayout>;
}

// ── Panel Resize Handle ────────────────────────────────────────────────────────

interface ResizeHandleProps {
  onResize: (width: number) => void;
  currentWidth: number;
}

function PanelResizeHandle({ onResize, currentWidth }: ResizeHandleProps) {
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing.current = true;
      startX.current = e.clientX;
      startWidth.current = currentWidth;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;
        const diff = startX.current - e.clientX; // Negative because panel is on right
        const viewportWidth = window.innerWidth;
        const newWidthPercent = Math.max(
          25,
          Math.min(50, ((startWidth.current / 100) * viewportWidth + diff) / viewportWidth * 100)
        );
        onResize(newWidthPercent);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [currentWidth, onResize]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-1.5 cursor-col-resize group shrink-0"
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onResize(currentWidth + 2);
        if (e.key === 'ArrowRight') onResize(currentWidth - 2);
      }}
    >
      <div className="absolute inset-y-0 -left-1 right-1 group-hover:bg-primary/20 transition-colors rounded" />
      <div className="absolute inset-y-0 left-0 w-px bg-border group-hover:bg-primary/50 transition-colors" />
      <div className="absolute inset-y-0 right-0 w-px bg-border group-hover:bg-primary/50 transition-colors" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

// ── Panel Header ───────────────────────────────────────────────────────────────

interface PanelHeaderProps {
  title?: string;
  description?: string;
  onClose: () => void;
  isMobile?: boolean;
}

function PanelHeader({ title, description, onClose, isMobile }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-card sticky top-0 z-10">
      <div className="flex-1 min-w-0">
        {title && (
          <h3 className="text-sm font-semibold truncate">{title}</h3>
        )}
        {description && (
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!isMobile && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                  <PanelRightClose className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close Panel</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Desktop Panel ──────────────────────────────────────────────────────────────

interface DesktopPanelProps {
  panelWidth: number;
  children: React.ReactNode;
  header?: React.ReactNode;
  onResize: (width: number) => void;
}

function DesktopPanel({ panelWidth, children, header, onResize }: DesktopPanelProps) {
  return (
    <div
      className="shrink-0 border-l bg-card flex flex-col h-full"
      style={{ width: `${panelWidth}vw`, minWidth: '320px', maxWidth: '45vw' }}
    >
      {/* Resize Handle */}
      <PanelResizeHandle onResize={onResize} currentWidth={panelWidth} />

      {/* Header */}
      {header}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

// ── Mobile Bottom Sheet ────────────────────────────────────────────────────────

interface MobileBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
}

function MobileBottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: MobileBottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] sm:h-[90vh] p-0 flex flex-col"
      >
        <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
          {title && <SheetTitle>{title}</SheetTitle>}
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Mobile Full Modal ──────────────────────────────────────────────────────────

interface MobileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
}

function MobileModal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: MobileModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          {title && <DialogTitle>{title}</DialogTitle>}
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Split View Component ──────────────────────────────────────────────────

export function AmroSplitView({
  grid,
  panel,
  panelTitle,
  panelDescription,
  layoutMode = 'grid-only',
  isPanelOpen = false,
  panelWidth = 35,
  onLayoutModeChange,
  onPanelClose,
  onPanelResize,
  className,
}: AmroSplitViewProps) {
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Determine effective mode
  const effectiveMode = isMobile && isPanelOpen ? 'modal' : layoutMode;

  // Panel header
  const panelHeader = !isMobile ? (
    <PanelHeader
      title={panelTitle}
      description={panelDescription}
      onClose={onPanelClose || (() => onLayoutModeChange?.('grid-only'))}
      isMobile={false}
    />
  ) : null;

  // Render based on mode
  if (!isPanelOpen && layoutMode === 'grid-only') {
    // Grid only mode
    return (
      <div className={cn('w-full transition-all duration-300', className)}>
        {grid}
      </div>
    );
  }

  if (isMobile) {
    // Mobile: Grid + Modal/Bottom Sheet
    return (
      <div className={cn('w-full', className)}>
        {grid}

        {/* Bottom Sheet for split-view on mobile */}
        {effectiveMode === 'split-view' && (
          <MobileBottomSheet
            open={isPanelOpen}
            onOpenChange={(open) => {
              if (!open) onPanelClose?.();
            }}
            title={panelTitle}
            description={panelDescription}
          >
            {panel}
          </MobileBottomSheet>
        )}

        {/* Full Modal for modal mode on mobile */}
        {effectiveMode === 'modal' && (
          <MobileModal
            open={isPanelOpen}
            onOpenChange={(open) => {
              if (!open) onPanelClose?.();
            }}
            title={panelTitle}
            description={panelDescription}
          >
            {panel}
          </MobileModal>
        )}
      </div>
    );
  }

  // Desktop: Split view with resizable panel
  return (
    <div className={cn('flex w-full h-full transition-all duration-300', className)}>
      {/* Grid Area */}
      <div className={cn(
        'flex-1 min-w-0 transition-all duration-300',
        isPanelOpen ? 'mr-0' : ''
      )}>
        {grid}
      </div>

      {/* Panel Area */}
      {isPanelOpen && (
        <DesktopPanel
          panelWidth={panelWidth}
          header={panelHeader}
          onResize={onPanelResize || (() => {})}
        >
          {panel}
        </DesktopPanel>
      )}
    </div>
  );
}

// ── Layout Toggle Component ────────────────────────────────────────────────────

export interface LayoutToggleProps {
  mode: GridLayoutMode;
  isPanelOpen: boolean;
  onModeChange: (mode: GridLayoutMode) => void;
  onTogglePanel: () => void;
  className?: string;
}

export function LayoutToggle({
  mode,
  isPanelOpen,
  onModeChange,
  onTogglePanel,
  className,
}: LayoutToggleProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select
        value={mode}
        onValueChange={(next) => onModeChange(next as GridLayoutMode)}
      >
        <SelectTrigger className="h-8 w-[156px]" aria-label="Layout mode selector">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="grid-only">Table</SelectItem>
          <SelectItem value="split-view">Split</SelectItem>
          <SelectItem value="modal">Modal</SelectItem>
        </SelectContent>
      </Select>
      {mode === 'split-view' ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onTogglePanel}
                className="h-8 px-2"
                aria-label={isPanelOpen ? 'Close side panel' : 'Open side panel'}
              >
                {isPanelOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isPanelOpen ? 'Close side panel' : 'Open side panel with form'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
