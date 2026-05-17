/**
 * TerminalPage — multi-panel professional trading terminal.
 *
 * Route: /dashboard/markets/terminal
 *
 * Full-screen layout (no DashboardLayout wrapper) with:
 *   - Compact 48px header with preset tabs + symbol + add panel
 *   - CSS grid workspace: 12 cols × 8 rows, height = 100vh - 48px
 *   - Panel configs persisted to localStorage
 *   - SymbolContext wires panel symbol sync
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Grid,
  Layers,
  LayoutDashboard,
  Plus,
  Radar,
  TrendingUp,
  Wifi,
  Zap,
} from "lucide-react";
import { WORKSPACE_PRESETS, type PanelConfig, type WorkspaceConfig } from "../terminal/workspacePresets";
import { PANEL_REGISTRY, type PanelType } from "../terminal/panelRegistry";
import { PanelShell } from "../terminal/PanelShell";
import { SymbolProvider, useSymbol } from "../terminal/SymbolContext";
import { isMarketOpen, marketStatusLabel } from "../utils/market-hours";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/design-system";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lnai_terminal_workspace";

const PRESET_ICONS: Record<string, React.ReactNode> = {
  Zap:        <Zap className="h-3.5 w-3.5" />,
  TrendingUp: <TrendingUp className="h-3.5 w-3.5" />,
  Layers:     <Layers className="h-3.5 w-3.5" />,
  Radar:      <Radar className="h-3.5 w-3.5" />,
  Grid:       <Grid className="h-3.5 w-3.5" />,
};

// ── Persistence helpers ───────────────────────────────────────────────────────

interface SavedState {
  presetId: string;
  panels: PanelConfig[];
}

function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.presetId === "string" &&
      Array.isArray(parsed.panels)
    ) {
      return parsed as SavedState;
    }
    return null;
  } catch {
    return null;
  }
}

function saveState(state: SavedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or disabled — silently ignore
  }
}

// ── Find next available grid slot ────────────────────────────────────────────

function findNextSlot(
  panels: PanelConfig[],
  defaultWidth: number,
  defaultHeight: number,
  gridCols = 12,
  gridRows = 8,
): { colStart: number; rowStart: number } {
  // Simple strategy: scan row by row for first empty 2×2 block
  for (let row = 1; row <= gridRows - defaultHeight + 1; row++) {
    for (let col = 1; col <= gridCols - defaultWidth + 1; col++) {
      const overlaps = panels.some((p) => {
        const pColEnd = p.colStart + p.colSpan;
        const pRowEnd = p.rowStart + p.rowSpan;
        const newColEnd = col + defaultWidth;
        const newRowEnd = row + defaultHeight;
        return (
          col < pColEnd &&
          newColEnd > p.colStart &&
          row < pRowEnd &&
          newRowEnd > p.rowStart
        );
      });
      if (!overlaps) return { colStart: col, rowStart: row };
    }
  }
  // Fallback: place at origin (may overlap)
  return { colStart: 1, rowStart: 1 };
}

// ── Inner page (uses SymbolContext) ──────────────────────────────────────────

function TerminalInner() {
  const { symbol, setSymbol } = useSymbol();
  const marketOpen = isMarketOpen();
  const statusLabel = marketStatusLabel();

  const [activePreset, setActivePreset] = useState<WorkspaceConfig>(() => {
    const saved = loadState();
    return (
      WORKSPACE_PRESETS.find((p) => p.id === saved?.presetId) ?? WORKSPACE_PRESETS[0]
    );
  });

  const [panels, setPanels] = useState<PanelConfig[]>(() => {
    const saved = loadState();
    if (saved?.panels && saved.presetId && WORKSPACE_PRESETS.some((p) => p.id === saved.presetId)) {
      return saved.panels;
    }
    return WORKSPACE_PRESETS[0].panels;
  });

  // Persist whenever panels or preset changes
  useEffect(() => {
    saveState({ presetId: activePreset.id, panels });
  }, [activePreset.id, panels]);

  const handlePresetChange = useCallback((preset: WorkspaceConfig) => {
    setActivePreset(preset);
    setPanels(preset.panels);
  }, []);

  const handleClosePanel = useCallback((id: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleAddPanel = useCallback((type: PanelType) => {
    const def = PANEL_REGISTRY[type];
    const { colStart, rowStart } = findNextSlot(
      panels,
      def.defaultWidth,
      def.defaultHeight,
    );
    const newPanel: PanelConfig = {
      id: `${type}-${Date.now()}`,
      type,
      colStart,
      rowSpan: def.defaultHeight,
      colSpan: def.defaultWidth,
      rowStart,
    };
    setPanels((prev) => [...prev, newPanel]);
    // Switch to custom preset when manually adding panels
    if (activePreset.id !== "custom") {
      setActivePreset(WORKSPACE_PRESETS.find((p) => p.id === "custom")!);
    }
  }, [panels, activePreset.id]);

  // Compute row height based on viewport
  const HEADER_H = 48;
  const GRID_ROWS = activePreset.gridRows;
  // Each row = (100vh - header) / gridRows — approximated for CSS usage
  const rowHeightPx = Math.floor((window.innerHeight - HEADER_H) / GRID_ROWS);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-2 px-3 h-12 shrink-0 border-b border-border/60 bg-card/80 backdrop-blur-sm z-20">
        {/* Back to markets */}
        <Link
          to="/dashboard/markets"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs mr-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <LayoutDashboard className="h-3.5 w-3.5" />
        </Link>

        <div className="w-px h-5 bg-border" />

        {/* Preset tabs */}
        <div className="flex items-center gap-0.5">
          {WORKSPACE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetChange(preset)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
                activePreset.id === preset.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {PRESET_ICONS[preset.icon] ?? <Grid className="h-3.5 w-3.5" />}
              {preset.name}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border ml-1" />

        {/* Active symbol display */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50 ml-1">
          <span className="text-xs font-mono font-semibold">{symbol}</span>
        </div>

        {/* Quick symbol switcher */}
        <div className="flex items-center gap-0.5">
          {["NIFTY 50", "NIFTY BANK", "SENSEX"].map((sym) => (
            <button
              key={sym}
              onClick={() => setSymbol(sym)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors",
                symbol === sym
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {sym}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Market status */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-border/50 text-xs">
          {marketOpen ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          ) : (
            <Wifi className="h-3 w-3 text-muted-foreground" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              marketOpen ? "text-emerald-500" : "text-muted-foreground",
            )}
          >
            {statusLabel}
          </span>
        </div>

        {/* Add panel dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 px-2.5 py-1 rounded bg-muted/60 hover:bg-muted text-xs font-medium transition-colors">
              <Plus className="h-3.5 w-3.5" />
              Add Panel
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {(Object.values(PANEL_REGISTRY)).map((def) => (
              <DropdownMenuItem
                key={def.type}
                onClick={() => handleAddPanel(def.type)}
                className="text-xs"
              >
                {def.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* ── Workspace grid ──────────────────────────────────────────────────── */}
      <main
        className="flex-1 overflow-hidden p-1.5 gap-1.5"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          height: `calc(100vh - ${HEADER_H}px)`,
        }}
      >
        {panels.map((panel) => (
          <PanelShell
            key={panel.id}
            config={panel}
            rowHeight={rowHeightPx}
            onClose={handleClosePanel}
          />
        ))}

        {panels.length === 0 && (
          <div
            className="flex flex-col items-center justify-center gap-3 text-muted-foreground rounded-lg border border-dashed border-border"
            style={{ gridColumn: "1 / span 12", gridRow: "1 / span 8" }}
          >
            <Grid className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">No panels in this workspace</p>
            <p className="text-xs">Select a preset above or click Add Panel</p>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Page root — wraps with SymbolProvider ─────────────────────────────────────

export default function TerminalPage() {
  return (
    <SymbolProvider initialSymbol="NIFTY 50" initialExchange="NSE">
      <TerminalInner />
    </SymbolProvider>
  );
}
