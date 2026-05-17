/**
 * Terminal panel registry — defines all available panel types,
 * their metadata, and display properties.
 */

export type PanelType =
  | "chart"
  | "watchlist"
  | "order_form"
  | "option_chain"
  | "portfolio"
  | "scanner"
  | "news"
  | "depth";

export interface PanelDefinition {
  type: PanelType;
  title: string;
  icon: string; // lucide icon name
  minWidth: number; // minimum grid columns (1-12)
  minHeight: number; // minimum grid rows
  defaultWidth: number;
  defaultHeight: number;
}

export const PANEL_REGISTRY: Record<PanelType, PanelDefinition> = {
  chart: {
    type: "chart",
    title: "Chart",
    icon: "CandlestickChart",
    minWidth: 4,
    minHeight: 3,
    defaultWidth: 8,
    defaultHeight: 5,
  },
  watchlist: {
    type: "watchlist",
    title: "Watchlist",
    icon: "Eye",
    minWidth: 2,
    minHeight: 3,
    defaultWidth: 3,
    defaultHeight: 5,
  },
  order_form: {
    type: "order_form",
    title: "Order Entry",
    icon: "ShoppingCart",
    minWidth: 3,
    minHeight: 4,
    defaultWidth: 4,
    defaultHeight: 5,
  },
  option_chain: {
    type: "option_chain",
    title: "Option Chain",
    icon: "TrendingUp",
    minWidth: 6,
    minHeight: 4,
    defaultWidth: 9,
    defaultHeight: 5,
  },
  portfolio: {
    type: "portfolio",
    title: "Portfolio",
    icon: "Wallet",
    minWidth: 4,
    minHeight: 3,
    defaultWidth: 6,
    defaultHeight: 4,
  },
  scanner: {
    type: "scanner",
    title: "Scanner",
    icon: "Radar",
    minWidth: 3,
    minHeight: 3,
    defaultWidth: 4,
    defaultHeight: 4,
  },
  news: {
    type: "news",
    title: "News",
    icon: "Newspaper",
    minWidth: 2,
    minHeight: 3,
    defaultWidth: 3,
    defaultHeight: 4,
  },
  depth: {
    type: "depth",
    title: "Market Depth",
    icon: "BarChart2",
    minWidth: 2,
    minHeight: 3,
    defaultWidth: 3,
    defaultHeight: 4,
  },
};
