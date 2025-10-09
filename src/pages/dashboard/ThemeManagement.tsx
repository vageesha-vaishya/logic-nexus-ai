import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HslPicker } from '@/components/ui/hsl-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { THEME_PRESETS } from '@/theme/themes';
import { useTheme } from '@/hooks/useTheme';
import { useCRM } from '@/hooks/useCRM';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function ThemeManagement() {
  const { themes, applyTheme, saveTheme, setActive, activeThemeName, toggleDark, scope, setScope } = useTheme();
  const { context } = useCRM();
  const [searchParams, setSearchParams] = useSearchParams();
  const [name, setName] = useState('Custom Theme');
  const [start, setStart] = useState('217 91% 60%');
  const [end, setEnd] = useState('197 71% 52%');
  const [primary, setPrimary] = useState('217 91% 60%');
  const [accent, setAccent] = useState('197 71% 52%');
  const [titleStrip, setTitleStrip] = useState('197 71% 52%');
  // Table header tokens
  const [tableHeaderText, setTableHeaderText] = useState('0 0% 100%');
  const [tableHeaderSeparator, setTableHeaderSeparator] = useState<string | undefined>(undefined);
  const [tableHeaderBackground, setTableHeaderBackground] = useState<string | undefined>(undefined);
  const [tableBackground, setTableBackground] = useState<string | undefined>(undefined);
  const [tableForeground, setTableForeground] = useState<string | undefined>(undefined);
  const [angle, setAngle] = useState(135);
  // Main page background gradient overrides (default to primary gradient)
  const [bgStart, setBgStart] = useState<string | undefined>(undefined);
  const [bgEnd, setBgEnd] = useState<string | undefined>(undefined);
  const [bgAngle, setBgAngle] = useState<number | undefined>(undefined);
  const [radius, setRadius] = useState('0.75rem');
  const [sidebarBackground, setSidebarBackground] = useState('222 47% 11%');
  const [sidebarAccent, setSidebarAccent] = useState('217 32% 17%');
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);

  // Removed local HSL/HEX helpers (now handled by HslPicker)

  useEffect(() => {
    if (activeThemeName) {
      const found = themes.find(t => t.name === activeThemeName);
      if (found) {
        setName(found.name);
        setStart(found.start);
        setEnd(found.end);
        setPrimary(found.primary || primary);
        setAccent(found.accent || accent);
        setAngle(found.angle ?? angle);
        setBgStart(found.bgStart ?? found.start);
        setBgEnd(found.bgEnd ?? found.end);
        setBgAngle(found.bgAngle ?? found.angle ?? angle);
        setRadius(found.radius ?? radius);
        setSidebarBackground(found.sidebarBackground || sidebarBackground);
        setSidebarAccent(found.sidebarAccent || sidebarAccent);
        setDark(found.dark ?? dark);
        // Table header tokens (fallback to accessible defaults by mode)
        setTableHeaderText((found as any).tableHeaderText || '0 0% 100%');
        setTableHeaderSeparator((found as any).tableHeaderSeparator || ((found?.dark ?? dark) ? '0 0% 100% / 0.75' : '0 0% 0% / 0.2'));
        // New table header/table background tokens
        setTableHeaderBackground((found as any).tableHeaderBackground || found.titleStrip || accent || primary);
        setTableBackground((found as any).tableBackground || ((found?.dark ?? dark) ? '222 47% 11%' : '0 0% 100%'));
        setTableForeground((found as any).tableForeground || ((found?.dark ?? dark) ? '210 40% 98%' : '222.2 84% 4.9%'));
      }
    }
  }, [activeThemeName, themes]);

  // Honor scope from query parameter if provided
  useEffect(() => {
    const s = searchParams.get('scope');
    if (s === 'user' || s === 'franchise' || s === 'tenant' || s === 'platform') {
      setScope(s as any);
    }
  }, [searchParams]);

  const canWrite = useMemo(() => {
    if (scope === 'user') return !!context?.userId;
    if (scope === 'franchise') return !!context?.isFranchiseAdmin;
    if (scope === 'tenant') return !!context?.isTenantAdmin;
    if (scope === 'platform') return !!context?.isPlatformAdmin;
    return false;
  }, [scope, context?.userId, context?.isFranchiseAdmin, context?.isTenantAdmin, context?.isPlatformAdmin]);

  const allThemes = useMemo(() => {
    return [...THEME_PRESETS, ...themes];
  }, [themes]);

  const resetTableDefaults = () => {
    // Apply theme without explicit table tokens to trigger dynamic defaults
    applyTheme({
      start,
      end,
      primary,
      accent,
      titleStrip,
      angle,
      radius,
      sidebarBackground,
      sidebarAccent,
      dark,
      bgStart: bgStart ?? start,
      bgEnd: bgEnd ?? end,
      bgAngle: bgAngle ?? angle,
    });
    // Read computed CSS variables set by applyTheme
    const root = document.documentElement;
    const readVar = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
    const nextHeaderBg = readVar('--table-header-background');
    const nextTableBg = readVar('--table-background');
    const nextHeaderText = readVar('--table-header-text');
    const nextSeparator = readVar('--table-header-separator');
    const nextTableFg = readVar('--table-foreground');
    if (nextHeaderBg) setTableHeaderBackground(nextHeaderBg);
    if (nextTableBg) setTableBackground(nextTableBg);
    if (nextHeaderText) setTableHeaderText(nextHeaderText);
    if (nextSeparator) setTableHeaderSeparator(nextSeparator);
    if (nextTableFg) setTableForeground(nextTableFg);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Theme Management</h1>
          <p className="text-muted-foreground">Create, preview, and apply gradient themes.</p>
        </div>

        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <Label className="mr-2">Scope</Label>
              <Button
                variant={scope === 'user' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setScope('user'); setSearchParams({ scope: 'user' }); }}
              >User</Button>
              <Button
                variant={scope === 'franchise' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setScope('franchise'); setSearchParams({ scope: 'franchise' }); }}
              >Franchise</Button>
              <Button
                variant={scope === 'tenant' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setScope('tenant'); setSearchParams({ scope: 'tenant' }); }}
              >Tenant</Button>
              <Button
                variant={scope === 'platform' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setScope('platform'); setSearchParams({ scope: 'platform' }); }}
              >Platform</Button>
              {!canWrite && (
                <span className="ml-3 text-xs text-muted-foreground">View-only for this scope</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create / Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-6">
              <div className="space-y-2">
                <label className="text-sm">Theme Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <HslPicker label="Gradient Start" value={start} onChange={setStart} />
              <HslPicker label="Gradient End" value={end} onChange={setEnd} />
              <HslPicker label="Primary" value={primary} onChange={setPrimary} />
              <HslPicker label="Accent" value={accent} onChange={setAccent} />
              <HslPicker label="List Title Strip" value={titleStrip} onChange={setTitleStrip} />
              <HslPicker label="Table Header Text" value={tableHeaderText} onChange={setTableHeaderText} />
              <HslPicker label="Table Header Separator" value={tableHeaderSeparator ?? (dark ? '0 0% 100% / 0.75' : '0 0% 0% / 0.2')} onChange={(v) => setTableHeaderSeparator(v)} />
              <HslPicker label="Table Header Background" value={tableHeaderBackground ?? titleStrip} onChange={(v) => setTableHeaderBackground(v)} />
              <HslPicker label="Table Background" value={tableBackground ?? (dark ? '222 47% 11%' : '0 0% 100%')} onChange={(v) => setTableBackground(v)} />
              <HslPicker label="Table Text" value={tableForeground ?? (dark ? '210 40% 98%' : '222.2 84% 4.9%')} onChange={(v) => setTableForeground(v)} />
              <div className="col-span-full">
                <Button variant="outline" size="sm" onClick={resetTableDefaults}>Reset Table Defaults</Button>
              </div>
            </div>

            {/* Live Table Preview */}
            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Table Preview</div>
              <div
                className="border rounded-lg overflow-hidden"
                style={{
                  ["--table-background" as any]: tableBackground ?? (dark ? '222 47% 11%' : '0 0% 100%'),
                  ["--table-header-background" as any]: tableHeaderBackground ?? titleStrip ?? accent,
                  ["--table-header-text" as any]: tableHeaderText ?? (dark ? '210 40% 98%' : '222.2 84% 4.9%'),
                  ["--table-header-separator" as any]: tableHeaderSeparator ?? (dark ? '0 0% 100% / 0.75' : '0 0% 0% / 0.2'),
                  ["--table-foreground" as any]: tableForeground ?? (dark ? '210 40% 98%' : '222.2 84% 4.9%'),
                }}
              >
                <div className="p-3">
                  <table className="w-full caption-bottom text-sm border-collapse bg-[hsl(var(--table-background))] text-[hsl(var(--table-foreground))]">
                    <thead className="bg-[hsl(var(--table-header-background))] border-y border-[hsl(var(--table-header-separator))]">
                      <tr>
                        <th className="h-11 px-3 text-left font-medium text-[hsl(var(--table-header-text))]">Column A</th>
                        <th className="h-11 px-3 text-left font-medium text-[hsl(var(--table-header-text))]">Column B</th>
                        <th className="h-11 px-3 text-left font-medium text-[hsl(var(--table-header-text))]">Column C</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-3">Alpha</td>
                        <td className="p-3">Bravo</td>
                        <td className="p-3">Charlie</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-3">Delta</td>
                        <td className="p-3">Echo</td>
                        <td className="p-3">Foxtrot</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm">Gradient Angle</label>
                <div className="flex items-center gap-2">
                  <input className="flex-1" type="range" min={0} max={360} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
                  <Input type="number" min={0} max={360} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
                </div>
              </div>
              <div className="col-span-full">
                <div className="text-sm font-medium mb-2">Main Background Gradient</div>
                <div className="grid gap-4 md:grid-cols-3">
                  <HslPicker label="BG Start" value={bgStart ?? start} onChange={(v) => setBgStart(v)} />
                  <HslPicker label="BG End" value={bgEnd ?? end} onChange={(v) => setBgEnd(v)} />
                  <div className="space-y-2">
                    <label className="text-sm">BG Angle</label>
                    <div className="flex items-center gap-2">
                      <input className="flex-1" type="range" min={0} max={360} value={bgAngle ?? angle} onChange={(e) => setBgAngle(Number(e.target.value))} />
                      <Input type="number" min={0} max={360} value={bgAngle ?? angle} onChange={(e) => setBgAngle(Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm">Border Radius</label>
                <div className="flex items-center gap-2">
                  <select className="border rounded px-2 py-1 text-sm" value={radius} onChange={(e) => setRadius(e.target.value)}>
                    <option value="0rem">0</option>
                    <option value="0.25rem">0.25rem</option>
                    <option value="0.5rem">0.5rem</option>
                    <option value="0.75rem">0.75rem</option>
                    <option value="1rem">1rem</option>
                    <option value="1.5rem">1.5rem</option>
                    <option value="2rem">2rem</option>
                  </select>
                  <Input value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="e.g., 0.75rem" />
                </div>
              </div>
              <HslPicker label="Sidebar Background" value={sidebarBackground} onChange={setSidebarBackground} />
              <HslPicker label="Sidebar Accent" value={sidebarAccent} onChange={setSidebarAccent} />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Switch checked={dark} onCheckedChange={(v) => { setDark(v); toggleDark(v); }} />
              <Label>Dark Mode</Label>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button onClick={() => applyTheme({ start, end, primary, accent, titleStrip, angle, radius, sidebarBackground, sidebarAccent, dark, tableHeaderText, tableHeaderSeparator: tableHeaderSeparator ?? (dark ? '0 0% 100% / 0.75' : '0 0% 0% / 0.2'), tableHeaderBackground: tableHeaderBackground ?? titleStrip, tableBackground: tableBackground ?? (dark ? '222 47% 11%' : '0 0% 100%'), tableForeground: tableForeground ?? (dark ? '210 40% 98%' : '222.2 84% 4.9%'), bgStart: bgStart ?? start, bgEnd: bgEnd ?? end, bgAngle: bgAngle ?? angle })}>Preview</Button>
              <Button variant="secondary" onClick={() => setOpen(true)} disabled={!canWrite}>Save As</Button>
              <div className="flex-1 h-16 rounded-lg bg-gradient-primary shadow-primary flex items-center justify-between px-4">
                <Button className="rounded-lg" variant="default">Primary Button</Button>
                <div className="rounded-lg p-3 border bg-card text-card-foreground">Card Preview</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Presets & Saved Themes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allThemes.map((p) => (
                <div key={p.name} className="border rounded-lg overflow-hidden">
                  <div className="h-20 w-full" style={{ backgroundImage: `linear-gradient(${p.angle ?? 135}deg, hsl(${p.start}) 0%, hsl(${p.end}) 100%)` }} />
                  <div className="p-3 flex items-center justify-between">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => {
                        const isDarkPreset = typeof p.dark === 'boolean' ? p.dark : dark;
                        applyTheme({
                          start: p.start,
                          end: p.end,
                          primary: p.primary,
                          accent: p.accent,
                          angle: p.angle ?? angle,
                          bgStart: (p as any).bgStart ?? p.start,
                          bgEnd: (p as any).bgEnd ?? p.end,
                          bgAngle: (p as any).bgAngle ?? p.angle ?? angle,
                          radius: p.radius ?? radius,
                          sidebarBackground: p.sidebarBackground ?? sidebarBackground,
                          sidebarAccent: p.sidebarAccent ?? sidebarAccent,
                          dark: isDarkPreset,
                          tableHeaderText: (p as any).tableHeaderText ?? '0 0% 100%',
                          tableHeaderSeparator: (p as any).tableHeaderSeparator ?? (isDarkPreset ? '0 0% 100% / 0.75' : '0 0% 0% / 0.2'),
                          tableHeaderBackground: (p as any).tableHeaderBackground ?? (p as any).titleStrip ?? p.accent ?? p.primary,
                          tableBackground: (p as any).tableBackground ?? (isDarkPreset ? '222 47% 11%' : '0 0% 100%'),
                        });
                        if (canWrite) setActive(p.name);
                      }}>Apply</Button>
                      <Button size="sm" variant="secondary" onClick={() => {
                        setName(`${p.name} Copy`);
                        setStart(p.start);
                        setEnd(p.end);
                        setPrimary(p.primary || primary);
                        setAccent(p.accent || accent);
                        setAngle(p.angle ?? angle);
                        setBgStart((p as any).bgStart ?? p.start);
                        setBgEnd((p as any).bgEnd ?? p.end);
                        setBgAngle((p as any).bgAngle ?? p.angle ?? angle);
                        setRadius(p.radius ?? radius);
                        setSidebarBackground(p.sidebarBackground ?? sidebarBackground);
                        setSidebarAccent(p.sidebarAccent ?? sidebarAccent);
                        const isDarkPreset = p.dark ?? dark;
                        setDark(isDarkPreset);
                        setTableHeaderText((p as any).tableHeaderText ?? '0 0% 100%');
                        setTableHeaderSeparator((p as any).tableHeaderSeparator ?? (isDarkPreset ? '0 0% 100% / 0.75' : '0 0% 0% / 0.2'));
                        setTableHeaderBackground((p as any).tableHeaderBackground ?? (p as any).titleStrip ?? p.accent ?? p.primary);
                        setTableBackground((p as any).tableBackground ?? (isDarkPreset ? '222 47% 11%' : '0 0% 100%'));
                        if (canWrite) setOpen(true);
                      }}>Customize</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Theme As</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New theme name" />
            </div>
            <DialogFooter>
              <Button disabled={!canWrite} onClick={() => {
                saveTheme({ name, start, end, primary, accent, titleStrip, angle, radius, sidebarBackground, sidebarAccent, dark, tableHeaderText, tableHeaderSeparator: tableHeaderSeparator ?? (dark ? '0 0% 100% / 0.75' : '0 0% 0% / 0.2'), tableHeaderBackground: tableHeaderBackground ?? titleStrip, tableBackground: tableBackground ?? (dark ? '222 47% 11%' : '0 0% 100%'), tableForeground: tableForeground ?? (dark ? '210 40% 98%' : '222.2 84% 4.9%'), bgStart: bgStart ?? start, bgEnd: bgEnd ?? end, bgAngle: bgAngle ?? angle });
                setActive(name);
                applyTheme({ start, end, primary, accent, titleStrip, angle, radius, sidebarBackground, sidebarAccent, dark, tableHeaderText, tableHeaderSeparator: tableHeaderSeparator ?? (dark ? '0 0% 100% / 0.75' : '0 0% 0% / 0.2'), tableHeaderBackground: tableHeaderBackground ?? titleStrip, tableBackground: tableBackground ?? (dark ? '222 47% 11%' : '0 0% 100%'), tableForeground: tableForeground ?? (dark ? '210 40% 98%' : '222.2 84% 4.9%'), bgStart: bgStart ?? start, bgEnd: bgEnd ?? end, bgAngle: bgAngle ?? angle });
                setOpen(false);
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}