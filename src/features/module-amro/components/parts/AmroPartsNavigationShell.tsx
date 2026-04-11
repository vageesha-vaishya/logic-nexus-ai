import { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Menu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  getAllowedPartsModules,
  type AmroPartsUxRole,
  type PartsNavigationModuleDefinition,
  type PartsNavigationModuleId,
} from './partsNavigationConfig';

type Props = {
  activeRole: AmroPartsUxRole;
  onModuleChange?: (moduleId: PartsNavigationModuleId) => void;
  renderModule: (moduleId: PartsNavigationModuleId) => JSX.Element;
  initialModuleId?: PartsNavigationModuleId;
};

export function AmroPartsNavigationShell({
  activeRole,
  onModuleChange,
  renderModule,
  initialModuleId = 'overview',
}: Props): JSX.Element {
  const visibleModules = useMemo(() => getAllowedPartsModules(activeRole), [activeRole]);
  const [activeModuleId, setActiveModuleId] = useState<PartsNavigationModuleId>(initialModuleId);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navSwitchMs, setNavSwitchMs] = useState(0);

  useEffect(() => {
    if (visibleModules.some((module) => module.id === activeModuleId)) return;
    const fallback = visibleModules[0]?.id || 'overview';
    setActiveModuleId(fallback);
  }, [activeModuleId, visibleModules]);

  useEffect(() => {
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const raf = requestAnimationFrame(() => {
      const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      setNavSwitchMs(Math.max(0, Math.round(endedAt - startedAt)));
    });
    return () => cancelAnimationFrame(raf);
  }, [activeModuleId]);

  const activeModule = visibleModules.find((module) => module.id === activeModuleId) || visibleModules[0];

  const handleModuleChange = (moduleId: PartsNavigationModuleId) => {
    setActiveModuleId(moduleId);
    onModuleChange?.(moduleId);
    setMobileNavOpen(false);
  };

  return (
    <div className="space-y-3">
      <Card className="border-slate-300">
        <CardContent className="space-y-3 p-3">
          {/* Header with breadcrumb and controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">AMRO Parts Navigation</p>
              </div>
              <Breadcrumb>
                <BreadcrumbList className="text-xs">
                  <BreadcrumbItem>AMRO</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>Parts Inventory</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem><BreadcrumbPage>{activeModule?.label || 'Overview'}</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-2">
              {/* Issue TY-01: Minimum 12px font size (text-xs = 12px) */}
              <Badge variant={navSwitchMs <= 200 ? 'secondary' : 'destructive'} className="text-xs">
                Nav Response {navSwitchMs}ms
              </Badge>
              <Badge variant="outline" className="text-xs">{activeRole}</Badge>
              {/* Mobile menu drawer for accessing all modules on small screens */}
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button type="button" size="sm" variant="outline" className="min-h-[44px] h-11 md:hidden">
                    <Menu className="mr-1 h-4 w-4" />
                    All Modules
                  </Button>
                </SheetTrigger>
                {/* Issue RD-02: Mobile touch navigation - optimized sheet */}
                <SheetContent side="left" className="w-[85vw] max-w-sm h-screen">
                  <SheetHeader>
                    <SheetTitle>All Parts Modules</SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="mt-3 h-full pr-4">
                    <div className="space-y-2 py-4">
                      {visibleModules.map((module) => {
                        const active = module.id === activeModuleId;
                        return (
                          <Button
                            key={`mobile-${module.id}`}
                            type="button"
                            variant={active ? 'default' : 'outline'}
                            size="sm"
                            className="w-full h-11 min-h-[44px] justify-start text-left"
                            onClick={() => handleModuleChange(module.id)}
                          >
                            <div className="flex flex-col items-start">
                              <span className="text-sm font-medium">{module.label}</span>
                              <span className="text-xs text-muted-foreground line-clamp-1">{module.description}</span>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Unified Quick Access Bar - All modules in a single scrollable row */}
          <div className="flex items-center gap-2">
            <ScrollArea className="w-full">
              <div className="flex min-w-max items-center gap-2">
                {visibleModules.map((module) => {
                  const active = module.id === activeModuleId;
                  return (
                    <Button
                      key={`quick-${module.id}`}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className="h-11 min-h-[44px] text-xs md:h-9"
                      onClick={() => handleModuleChange(module.id)}
                      aria-current={active ? 'page' : undefined}
                    >
                      {module.label}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Module content area */}
      <div aria-live="polite" aria-atomic="false">
        {/* Screen reader announcement for module changes */}
        <div className="sr-only" role="status" aria-live="polite">
          {activeModule ? `Now viewing ${activeModule.label} module` : 'Now viewing Overview module'}
        </div>
        {/* Issue AC-01: Focus management - content region can receive focus */}
        <div
          id={`module-content-${activeModuleId}`}
          tabIndex={-1}
          className="outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {activeModule ? renderModule(activeModule.id) : renderModule('overview')}
        </div>
      </div>
    </div>
  );
}
