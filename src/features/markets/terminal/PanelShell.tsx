/**
 * PanelShell — shared wrapper for all terminal panels.
 *
 * Features:
 *   - Header: icon + title + linked symbol + close button
 *   - Glass-morphism dark style with border + rounded + shadow
 *   - Delegates panel content rendering via switch on PanelType
 */

import {
  BarChart2,
  CandlestickChart,
  Eye,
  Layers,
  Newspaper,
  Radar,
  ShoppingCart,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import type { PanelConfig } from "./workspacePresets";
import { PANEL_REGISTRY } from "./panelRegistry";
import { ChartPanel } from "./panels/ChartPanel";
import { WatchlistPanel } from "./panels/WatchlistPanel";
import { OrderFormPanel } from "./panels/OrderFormPanel";
import { OptionChainPanel } from "./panels/OptionChainPanel";
import { PortfolioPanel } from "./panels/PortfolioPanel";
import { ScannerPanel } from "./panels/ScannerPanel";
import { DepthPanel } from "./panels/DepthPanel";
import { NewsPanelWrapper } from "./panels/NewsPanelWrapper";
import { cn } from "@/lib/utils";

const PANEL_ICONS: Record<string, React.ReactNode> = {
  CandlestickChart: <CandlestickChart className="h-3.5 w-3.5" />,
  Eye:              <Eye className="h-3.5 w-3.5" />,
  ShoppingCart:     <ShoppingCart className="h-3.5 w-3.5" />,
  TrendingUp:       <TrendingUp className="h-3.5 w-3.5" />,
  Wallet:           <Wallet className="h-3.5 w-3.5" />,
  Radar:            <Radar className="h-3.5 w-3.5" />,
  Newspaper:        <Newspaper className="h-3.5 w-3.5" />,
  BarChart2:        <BarChart2 className="h-3.5 w-3.5" />,
  Layers:           <Layers className="h-3.5 w-3.5" />,
};

export interface PanelShellProps {
  config: PanelConfig;
  rowHeight: number; // pixel height of one grid row
  onClose: (id: string) => void;
}

export function PanelShell({ config, rowHeight, onClose }: PanelShellProps) {
  const def = PANEL_REGISTRY[config.type];
  const contentHeight = config.rowSpan * rowHeight - 32; // 32px = header height

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border/60",
        "bg-card/95 backdrop-blur-sm shadow-lg",
      )}
      style={{
        gridColumn: `${config.colStart} / span ${config.colSpan}`,
        gridRow: `${config.rowStart} / span ${config.rowSpan}`,
      }}
    >
      {/* Panel header */}
      <div className="flex items-center gap-1.5 px-2 h-8 shrink-0 border-b border-border/40 bg-muted/20">
        <span className="text-muted-foreground">
          {PANEL_ICONS[def.icon] ?? <CandlestickChart className="h-3.5 w-3.5" />}
        </span>
        <span className="text-xs font-semibold tracking-tight truncate flex-1">
          {def.title}
        </span>
        {config.symbol && (
          <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm">
            {config.symbol}
          </span>
        )}
        <button
          onClick={() => onClose(config.id)}
          className="ml-auto h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label={`Close ${def.title} panel`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden p-1">
        <PanelContent config={config} contentHeight={contentHeight} />
      </div>
    </div>
  );
}

function PanelContent({
  config,
  contentHeight,
}: {
  config: PanelConfig;
  contentHeight: number;
}) {
  switch (config.type) {
    case "chart":
      return (
        <ChartPanel
          symbol={config.symbol}
          exchange={config.exchange}
          height={contentHeight}
        />
      );

    case "watchlist":
      return <WatchlistPanel />;

    case "order_form":
      return <OrderFormPanel symbol={config.symbol} />;

    case "option_chain":
      return <OptionChainPanel />;

    case "portfolio":
      return <PortfolioPanel />;

    case "scanner":
      return <ScannerPanel />;

    case "depth":
      return <DepthPanel symbol={config.symbol} />;

    case "news":
      return <NewsPanelWrapper />;

    default:
      return (
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
          Unknown panel type
        </div>
      );
  }
}
