/**
 * Settings → Branding — per-tenant white-label inside the dashboard.
 *
 * Tenant_admin can:
 *   - Upload a logo (Supabase Storage: tenant-branding/{tenant_id}/logo.{ext})
 *   - Pick an accent color (overrides --domain-accent for this tenant)
 *   - Set a display_name override that surfaces in the topbar in place
 *     of tenants.name
 *
 * Persisted to tenants.branding_settings jsonb via the existing
 * TenantBrandingService. Pre-auth surfaces (auth / welcome / signup /
 * invite) always show SOS chrome regardless of branding_settings — only
 * /dashboard/* surfaces honor the override.
 *
 * Sthira retail dashboards ignore branding_settings (Sthira chrome is
 * sacred per the brand architecture).
 *
 * See docs/plans/2026-05-22-platform-brand-architecture-design.md.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useMemberships } from "@/hooks/useMemberships";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { TenantBrandingService } from "@/services/branding/TenantBrandingService";
import type { BrandingSettings } from "@/services/quotation/QuotationConfigurationService";
import { accentForDomain } from "@/components/branding";

const STORAGE_BUCKET = "tenant-branding";
const ACCEPTED_MIME  = "image/png,image/jpeg,image/svg+xml,image/webp";

export default function BrandingSettings() {
  const { activeMembership } = useMemberships();
  const { branding, refresh } = useTenantBranding();

  const tenantId = activeMembership?.tenant_id ?? null;
  const isRetail = activeMembership?.is_retail ?? false;

  const [companyName, setCompanyName] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [logoUrl,     setLogoUrl]     = useState("");
  const [uploading,   setUploading]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seed form from current branding context once it lands.
  useEffect(() => {
    if (!branding) return;
    setCompanyName(branding.companyName ?? "");
    setAccentColor(branding.accentColor ?? "");
    setLogoUrl(branding.logoUrl ?? "");
  }, [branding]);

  const domainDefaultAccent = useMemo(
    () => accentForDomain(activeMembership?.domain_code ?? null),
    [activeMembership?.domain_code],
  );

  if (isRetail) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-2xl py-12 text-center text-sm text-muted-foreground">
          Sthira retail accounts don't support tenant branding — Sthira
          keeps its own consumer brand. Switch to a B2B workspace from the
          topbar to manage branding there.
        </div>
      </DashboardLayout>
    );
  }

  if (!tenantId && !branding) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-2xl py-12 text-center text-sm text-muted-foreground">
          Pick a workspace from the topbar switcher first.
        </div>
      </DashboardLayout>
    );
  }

  const handleUpload = async (file: File) => {
    if (!tenantId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      // Path: {tenant_id}/logo.{ext}. Always overwrite so the URL is
      // stable per tenant (no cache busting needed beyond the response
      // ETag — Supabase Storage handles that).
      const ext  = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${tenantId}/logo.${ext}`;
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      // Cache-bust so the new logo replaces a previously-uploaded one
      // before the browser HTTP cache catches up.
      const cacheBusted = `${data.publicUrl}?t=${Date.now()}`;
      setLogoUrl(cacheBusted);
      toast.success("Logo uploaded — save changes to apply.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClearLogo = () => {
    setLogoUrl("");
  };

  const handleSave = async () => {
    if (!tenantId) return;
    const payload: BrandingSettings = {
      ...(branding ? { /* preserve unknown keys via service merge */ } : {}),
      company_name: companyName.trim() || undefined,
      accent_color: accentColor || undefined,
      logo_url:     logoUrl     || undefined,
    };
    setSaving(true);
    try {
      await TenantBrandingService.updateBranding(payload, tenantId);
      await refresh();
      toast.success("Branding saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCompanyName("");
    setAccentColor("");
    setLogoUrl("");
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Branding</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customize how this workspace looks inside the dashboard.
            Pre-auth surfaces (login, signup, invites) always show the
            SOS Services chrome.
          </p>
        </header>

        {/* Display name */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Display name</CardTitle>
            <CardDescription>
              Shown in the topbar in place of the tenant's legal name. Leave
              empty to use "{activeMembership?.tenant_name}".
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="brand-name">Workspace display name</Label>
            <Input
              id="brand-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={activeMembership?.tenant_name ?? "Workspace name"}
              maxLength={64}
            />
          </CardContent>
        </Card>

        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logo</CardTitle>
            <CardDescription>
              Replaces the SOS master mark inside this workspace. PNG, JPG,
              SVG, or WebP. Up to 2 MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 rounded-md border bg-muted/40 flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Tenant logo preview" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_MIME}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f);
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || saving}
                >
                  {uploading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Upload className="h-4 w-4" /> Upload new logo
                    </span>
                  )}
                </Button>
                {logoUrl && (
                  <Button variant="ghost" size="sm" onClick={handleClearLogo} disabled={uploading || saving}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accent color */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Accent color
              {!accentColor && (
                <Badge variant="secondary" className="text-[10px]">
                  Domain default
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Used on the top strip and the membership-switcher dot inside
              this workspace. Leave empty to use this domain's default
              ({domainDefaultAccent}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={accentColor || domainDefaultAccent}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-16 cursor-pointer p-1"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder={domainDefaultAccent}
                maxLength={9}
                className="font-mono uppercase tracking-wider"
              />
              {accentColor && (
                <Button variant="ghost" size="sm" onClick={() => setAccentColor("")}>
                  Use domain default
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Save / reset row */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleReset} disabled={saving || uploading}>
            Reset
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || uploading}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </span>
            ) : "Save changes"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
