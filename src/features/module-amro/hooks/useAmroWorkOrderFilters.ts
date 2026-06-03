/**
 * Phase 8f.3a — work-order filter + saved-view state extracted from
 * useAmroWorkspaceState.
 *
 * Pure UI-filter state with a "saved view" persistence layer on top.
 * Doesn't touch the workOrders array itself — that gets extracted in
 * a later slice. The orchestrator's saveCurrentWorkOrderView callback
 * (which hits the AMRO API and reports errors) keeps the orchestrator-
 * level setSavedWorkOrderViews + setSelectedSavedViewId references
 * exposed here.
 */
import { useCallback, useState } from "react";

import {
  DEFAULT_WORK_PACKAGE_SAVED_VIEW,
  type V2SavedWorkOrderView,
} from "./amroWorkspaceTypes";

export interface UseAmroWorkOrderFiltersReturn {
  workOrderStatusFilter: string;
  setWorkOrderStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  workOrderSearch: string;
  setWorkOrderSearch: React.Dispatch<React.SetStateAction<string>>;
  selectedSavedViewId: string;
  setSelectedSavedViewId: React.Dispatch<React.SetStateAction<string>>;
  savedWorkOrderViews: V2SavedWorkOrderView[];
  setSavedWorkOrderViews: React.Dispatch<React.SetStateAction<V2SavedWorkOrderView[]>>;
  /**
   * Apply a saved view by id: looks the view up (with sensible fallback
   * chain), then sets the selected-view id + the underlying status and
   * search filters from the view's stored filters.
   */
  applySavedWorkOrderView: (viewId: string) => void;
}

export function useAmroWorkOrderFilters(): UseAmroWorkOrderFiltersReturn {
  const [workOrderStatusFilter, setWorkOrderStatusFilter] = useState<string>("all");
  const [workOrderSearch, setWorkOrderSearch] = useState<string>("");
  const [selectedSavedViewId, setSelectedSavedViewId] = useState<string>(
    DEFAULT_WORK_PACKAGE_SAVED_VIEW.id,
  );
  const [savedWorkOrderViews, setSavedWorkOrderViews] = useState<V2SavedWorkOrderView[]>([
    DEFAULT_WORK_PACKAGE_SAVED_VIEW,
  ]);

  const applySavedWorkOrderView = useCallback(
    (viewId: string) => {
      const selectedView =
        savedWorkOrderViews.find((item) => item.id === viewId) ||
        savedWorkOrderViews.find((item) => item.id === DEFAULT_WORK_PACKAGE_SAVED_VIEW.id) ||
        savedWorkOrderViews[0] ||
        DEFAULT_WORK_PACKAGE_SAVED_VIEW;
      setSelectedSavedViewId(selectedView.id);
      setWorkOrderStatusFilter(selectedView.filters.status || "all");
      setWorkOrderSearch(selectedView.filters.search || "");
    },
    [savedWorkOrderViews],
  );

  return {
    workOrderStatusFilter,
    setWorkOrderStatusFilter,
    workOrderSearch,
    setWorkOrderSearch,
    selectedSavedViewId,
    setSelectedSavedViewId,
    savedWorkOrderViews,
    setSavedWorkOrderViews,
    applySavedWorkOrderView,
  };
}
