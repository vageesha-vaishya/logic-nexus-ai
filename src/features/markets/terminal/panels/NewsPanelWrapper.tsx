/**
 * NewsPanelWrapper — reuses the existing NewsPanel component in the terminal.
 * Reads active symbol from SymbolContext to filter news by instrument.
 */

import { useSymbol } from "../SymbolContext";
import { NewsPanel } from "../../components/NewsPanel";

export function NewsPanelWrapper() {
  const { symbol } = useSymbol();

  return (
    <NewsPanel
      instrument={symbol}
      limit={20}
      title={`${symbol} News`}
      className="h-full border-none shadow-none rounded-none bg-transparent"
    />
  );
}
