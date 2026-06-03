/**
 * Phase 8i — manifest redirect targets.
 *
 * The AMRO manifest exposes 4 routes whose original App.tsx
 * declarations were `<Navigate to="..." replace />` elements rather
 * than full pages. The manifest's DomainRoute interface requires a
 * lazy-imported component, so each redirect lives as a tiny
 * functional component here and the manifest lazy-imports them.
 *
 * Default behavior matches the App.tsx originals byte-for-byte.
 */
import { Navigate } from "react-router-dom";

export function AmroIndexRedirect(): JSX.Element {
  return <Navigate to="/dashboard/amro/overview" replace />;
}

export function AmroMasterDataRedirect(): JSX.Element {
  return <Navigate to="/dashboard/amro/settings/master-data/aircraft" replace />;
}

export function AmroMasterDataLegacyRedirect(): JSX.Element {
  return <Navigate to="/dashboard/amro/settings/master-data/aircraft" replace />;
}

export function AmroChangesRedirect(): JSX.Element {
  return <Navigate to="/dashboard/amro/work-orders" replace />;
}
