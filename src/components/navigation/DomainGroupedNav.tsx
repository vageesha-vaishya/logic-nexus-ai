/**
 * DomainGroupedNav — tenant-wide sidebar grouped by domain.
 *
 * Replaces the flat CommandCenterNav under the DOMAIN_GROUPED_NAV
 * feature flag. Walks the legacy APP_MENU (which already contains the
 * canonical menu items + role + permission metadata) and classifies each
 * item via `resolveActiveDomain(item.path)`. Items whose URL doesn't
 * match any domain's pathPrefixes go into a "Workspace" section at the
 * top (Settings / Profile / etc.). Items whose URL matches a domain are
 * bucketed into that domain's collapsible group.
 *
 * Per (user, tenant) localStorage remembers each group's collapse
 * state. Groups for the currently-active domain (resolveActiveDomain on
 * the current URL) auto-expand even if the user previously collapsed
 * them — they're navigating *into* that domain right now.
 *
 * "Add a product" footer link routes to /dashboard/settings/billing for
 * tenant_admins.
 *
 * See docs/plans/2026-05-22-module-visibility-and-domain-login-design.md
 * §"Sidebar shape".
 */
import { useMemo, useState, useEffect } from "react";
import { NavLink, useLocation, Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Plus, Settings as SettingsIcon } from "lucide-react";

import { APP_MENU, type MenuItem, type MenuModule } from "@/config/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMemberships } from "@/hooks/useMemberships";
import { resolveActiveDomain } from "@/platform/domains/resolver";
import { DOMAIN_MANIFESTS } from "@/platform/domains/registry";
import type { DomainManifest } from "@/platform/domains/types";
import { accentForDomain } from "@/components/branding";

interface GroupedItems {
  /** Items not owned by any domain (settings, profile, tenant-wide). */
  workspace: MenuItem[];
  /** Items per domain, keyed by domain code (e.g. "MARKETS"). */
  perDomain: Map<string, MenuItem[]>;
}

/**
 * Walk every APP_MENU item, classify by URL → domain. Items that match
 * no domain manifest prefix go into the "workspace" bucket.
 */
function groupItemsByDomain(menu: readonly MenuModule[]): GroupedItems {
  const workspace: MenuItem[] = [];
  const perDomain = new Map<string, MenuItem[]>();

  for (const mod of menu) {
    for (const item of mod.items) {
      const domain = resolveActiveDomain(item.path);
      if (domain) {
        const bucket = perDomain.get(domain.code) ?? [];
        bucket.push(item);
        perDomain.set(domain.code, bucket);
      } else {
        workspace.push(item);
      }
    }
  }
  return { workspace, perDomain };
}

const COLLAPSE_KEY = (userId: string, tenantId: string) =>
  `sos.nav.collapsed.${userId}.${tenantId}`;

function readCollapsedSet(userId: string | undefined, tenantId: string | undefined): Set<string> {
  if (!userId || !tenantId || typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY(userId, tenantId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((s): s is string => typeof s === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeCollapsedSet(
  userId: string | undefined,
  tenantId: string | undefined,
  set: Set<string>,
) {
  if (!userId || !tenantId || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(COLLAPSE_KEY(userId, tenantId), JSON.stringify([...set]));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function DomainGroupedNav() {
  const { user, roles } = useAuth();
  const { activeMembership } = useMemberships();
  const { pathname } = useLocation();

  // Bucketed items — recomputed when APP_MENU changes (which is build-time,
  // so effectively once per session, but useMemo keeps it tidy).
  const grouped = useMemo(() => groupItemsByDomain(APP_MENU), []);

  // Which domain is the user in *right now*? Auto-expands its group.
  const activeDomain = useMemo(() => resolveActiveDomain(pathname), [pathname]);

  // Domains the tenant actually has groups for — intersect manifests
  // with the buckets that have items. We don't yet wire
  // tenant_domain_assignments here (would need an extra query) — for the
  // MV-3 MVP we render every domain that has menu items. MV-4 will tie
  // this to assignment status.
  const tenantDomains = useMemo<DomainManifest[]>(
    () => DOMAIN_MANIFESTS.filter(
      (m) => m.sidebar !== undefined && (grouped.perDomain.get(m.code)?.length ?? 0) > 0,
    ),
    [grouped],
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    readCollapsedSet(user?.id, activeMembership?.tenant_id),
  );
  useEffect(() => {
    setCollapsed(readCollapsedSet(user?.id, activeMembership?.tenant_id));
  }, [user?.id, activeMembership?.tenant_id]);

  const toggle = (code: string) => {
    const next = new Set(collapsed);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setCollapsed(next);
    writeCollapsedSet(user?.id, activeMembership?.tenant_id, next);
  };

  const isTenantAdmin = roles.some(
    (r) => r.role === "tenant_admin" || r.role === "platform_admin",
  );

  return (
    <>
      {/* Workspace section — tenant-wide items (no domain). */}
      {grouped.workspace.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <SettingsIcon className="h-3 w-3" />
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {grouped.workspace.map((item) => (
                <NavItem key={item.path} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {/* Per-domain groups — collapsible. */}
      {tenantDomains.map((domain) => {
        const items = grouped.perDomain.get(domain.code) ?? [];
        const isActiveDomain = activeDomain?.code === domain.code;
        // Active domain ignores localStorage and always opens
        const open = isActiveDomain || !collapsed.has(domain.code);
        const Icon = domain.sidebar!.icon;
        const accent = accentForDomain(domain.code.toLowerCase());

        return (
          <Collapsible
            key={domain.code}
            open={open}
            onOpenChange={() => toggle(domain.code)}
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger
                  className="flex w-full items-center gap-2 hover:text-foreground"
                  aria-label={`Toggle ${domain.sidebar!.label} group`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: accent }}
                  />
                  <Icon className="h-3 w-3" />
                  <span className="flex-1 text-left">{domain.sidebar!.label}</span>
                  {open ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {items.map((item) => (
                      <NavItem key={item.path} item={item} accentHex={accent} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        );
      })}

      {/* "Add a product" footer — tenant_admins only. */}
      {isTenantAdmin && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/dashboard/settings/billing" className="text-muted-foreground">
                    <Plus className="h-4 w-4" />
                    <span>Add a product</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  );
}

interface NavItemProps {
  item:      MenuItem;
  /** Domain accent hex for the active-item left border. Omit for workspace items. */
  accentHex?: string;
}

function NavItem({ item, accentHex }: NavItemProps) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.path}
          end={false}
          className={({ isActive }) =>
            cn(
              "relative flex items-center gap-2 py-1.5",
              isActive && "bg-accent/40 font-medium text-foreground",
            )
          }
          style={({ isActive }) =>
            isActive && accentHex
              ? { borderLeft: `3px solid ${accentHex}`, paddingLeft: 9 }
              : undefined
          }
          title={item.description}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.name}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export default DomainGroupedNav;
