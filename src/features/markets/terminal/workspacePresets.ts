/**
 * Terminal workspace presets — predefined panel layouts
 * for common trading workflows (Trade, Invest, F&O, Scanner, Custom).
 */

import type { PanelType } from "./panelRegistry";

export interface PanelConfig {
  id: string;
  type: PanelType;
  symbol?: string; // linked symbol (chart + depth + order form sync)
  exchange?: string;
  // CSS grid position
  colStart: number; // 1-12
  colSpan: number;  // 1-12
  rowStart: number;
  rowSpan: number;
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  icon: string;
  panels: PanelConfig[];
  gridCols: number; // always 12
  gridRows: number;
}

export const WORKSPACE_PRESETS: WorkspaceConfig[] = [
  {
    id: "trade",
    name: "Trade",
    icon: "Zap",
    gridCols: 12,
    gridRows: 8,
    panels: [
      {
        id: "chart-main",
        type: "chart",
        colStart: 1,
        colSpan: 8,
        rowStart: 1,
        rowSpan: 5,
        symbol: "NIFTY 50",
      },
      {
        id: "watchlist",
        type: "watchlist",
        colStart: 9,
        colSpan: 4,
        rowStart: 1,
        rowSpan: 8,
      },
      {
        id: "depth",
        type: "depth",
        colStart: 1,
        colSpan: 4,
        rowStart: 6,
        rowSpan: 3,
        symbol: "NIFTY 50",
      },
      {
        id: "order",
        type: "order_form",
        colStart: 5,
        colSpan: 4,
        rowStart: 6,
        rowSpan: 3,
        symbol: "NIFTY 50",
      },
    ],
  },
  {
    id: "invest",
    name: "Invest",
    icon: "TrendingUp",
    gridCols: 12,
    gridRows: 8,
    panels: [
      {
        id: "portfolio",
        type: "portfolio",
        colStart: 1,
        colSpan: 8,
        rowStart: 1,
        rowSpan: 4,
      },
      {
        id: "watchlist",
        type: "watchlist",
        colStart: 9,
        colSpan: 4,
        rowStart: 1,
        rowSpan: 8,
      },
      {
        id: "chart-main",
        type: "chart",
        colStart: 1,
        colSpan: 8,
        rowStart: 5,
        rowSpan: 4,
        symbol: "NIFTY 50",
      },
    ],
  },
  {
    id: "fno",
    name: "F&O",
    icon: "Layers",
    gridCols: 12,
    gridRows: 8,
    panels: [
      {
        id: "option-chain",
        type: "option_chain",
        colStart: 1,
        colSpan: 9,
        rowStart: 1,
        rowSpan: 5,
      },
      {
        id: "watchlist",
        type: "watchlist",
        colStart: 10,
        colSpan: 3,
        rowStart: 1,
        rowSpan: 8,
      },
      {
        id: "chart-main",
        type: "chart",
        colStart: 1,
        colSpan: 6,
        rowStart: 6,
        rowSpan: 3,
        symbol: "NIFTY 50",
      },
      {
        id: "order",
        type: "order_form",
        colStart: 7,
        colSpan: 3,
        rowStart: 6,
        rowSpan: 3,
      },
    ],
  },
  {
    id: "scanner",
    name: "Scanner",
    icon: "Radar",
    gridCols: 12,
    gridRows: 8,
    panels: [
      {
        id: "scanner",
        type: "scanner",
        colStart: 1,
        colSpan: 7,
        rowStart: 1,
        rowSpan: 8,
      },
      {
        id: "chart-main",
        type: "chart",
        colStart: 8,
        colSpan: 5,
        rowStart: 1,
        rowSpan: 5,
        symbol: "NIFTY 50",
      },
      {
        id: "depth",
        type: "depth",
        colStart: 8,
        colSpan: 5,
        rowStart: 6,
        rowSpan: 3,
        symbol: "NIFTY 50",
      },
    ],
  },
  {
    id: "custom",
    name: "Custom",
    icon: "Grid",
    gridCols: 12,
    gridRows: 8,
    panels: [],
  },
];
