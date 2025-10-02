import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { THEME_PRESETS } from '@/theme/themes';
import { useTheme } from '@/hooks/useTheme';

export default function ThemeManagement() {
  const { themes, applyTheme, saveTheme, setActive, activeThemeName } = useTheme();
  const [name, setName] = useState('Custom Theme');
  const [start, setStart] = useState('217 91% 60%');
  const [end, setEnd] = useState('197 71% 52%');
  const [primary, setPrimary] = useState('217 91% 60%');
  const [accent, setAccent] = useState('197 71% 52%');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (activeThemeName) {
      const found = themes.find(t => t.name === activeThemeName);
      if (found) {
        setName(found.name);
        setStart(found.start);
        setEnd(found.end);
        setPrimary(found.primary || primary);
        setAccent(found.accent || accent);
      }
    }
  }, [activeThemeName, themes]);

  const allThemes = useMemo(() => {
    return [...THEME_PRESETS, ...themes.map(t => ({ name: t.name, start: t.start, end: t.end, primary: t.primary, accent: t.accent }))];
  }, [themes]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Theme Management</h1>
          <p className="text-muted-foreground">Create, preview, and apply gradient themes.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create / Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm">Theme Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Gradient Start (HSL)</label>
                <Input value={start} onChange={(e) => setStart(e.target.value)} placeholder="e.g., 217 91% 60%" />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Gradient End (HSL)</label>
                <Input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="e.g., 197 71% 52%" />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Primary (HSL)</label>
                <Input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="e.g., 217 91% 60%" />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button onClick={() => applyTheme({ start, end, primary, accent })}>Preview</Button>
              <Button variant="secondary" onClick={() => setOpen(true)}>Save As</Button>
              <div className="flex-1 h-16 rounded-lg bg-gradient-primary shadow-primary" />
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
                  <div className="h-20 w-full" style={{ backgroundImage: `linear-gradient(135deg, hsl(${p.start}) 0%, hsl(${p.end}) 100%)` }} />
                  <div className="p-3 flex items-center justify-between">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { applyTheme({ start: p.start, end: p.end, primary: p.primary, accent: p.accent }); setActive(p.name); }}>Apply</Button>
                      <Button size="sm" variant="secondary" onClick={() => {
                        setName(`${p.name} Copy`);
                        setStart(p.start);
                        setEnd(p.end);
                        setPrimary(p.primary || primary);
                        setAccent(p.accent || accent);
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
              <Button onClick={() => {
                saveTheme({ name, start, end, primary, accent });
                setActive(name);
                applyTheme({ start, end, primary, accent });
                setOpen(false);
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}