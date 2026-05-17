/**
 * Global keyboard shortcut handler for the Markets module.
 *
 * Shortcuts:
 *   W   → Watchlists
 *   F   → F&O Chain
 *   A   → Price Alerts
 *   M   → Market Scanner (Signals)
 *   P   → Portfolios
 *   J   → Trade Journal
 *   ?   → Toggle shortcuts help modal
 *   Esc → (handled by individual modals/sheets via Radix)
 *
 * Does NOT fire when focus is in an input / textarea / select / contenteditable.
 * Does NOT fire when Ctrl / Meta / Alt is held (avoid clashing with browser hotkeys).
 */

import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";

export function useMarketKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      // Skip when typing
      const tag = (e.target as HTMLElement).tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Skip modifier combos
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case "?":
          e.preventDefault();
          setShowHelp((h) => !h);
          logger.debug("market.shortcut", { key: "?" });
          break;
        case "w":
          navigate("/dashboard/markets/watchlists");
          logger.debug("market.shortcut", { key: "w" });
          break;
        case "f":
          navigate("/dashboard/markets/fno");
          logger.debug("market.shortcut", { key: "f" });
          break;
        case "a":
          navigate("/dashboard/markets/alerts");
          logger.debug("market.shortcut", { key: "a" });
          break;
        case "m":
          navigate("/dashboard/markets/signals");
          logger.debug("market.shortcut", { key: "m" });
          break;
        case "p":
          navigate("/dashboard/markets/portfolios");
          logger.debug("market.shortcut", { key: "p" });
          break;
        case "j":
          navigate("/dashboard/markets/journal");
          logger.debug("market.shortcut", { key: "j" });
          break;
        default:
          break;
      }
    },
    [navigate],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  return { showHelp, setShowHelp };
}
