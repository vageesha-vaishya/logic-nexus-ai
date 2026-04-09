import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Rows3, Sparkles } from 'lucide-react';
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

function groupModules(modules: PartsNavigationModuleDefinition[]): Record<string, PartsNavigationModuleDefinition[]> {
  return modules.reduce<Record<string, PartsNavigationModuleDefinition[]>>((accumulator, module) => {
    if (!accumulator[module.group]) accumulator[module.group] = [];
    accumulator[module.group]?.push(module);
    return accumulator;
  }, {});
}

export function AmroPartsNavigationShell({
  activeRole,
  onModuleChange,
  renderModule,
  initialModuleId = 'overview',
}: Props): JSX.Element {
  const visibleModules = useMemo(() => getAllowedPartsModules(activeRole), [activeRole]);
  const grouped = useMemo(() => groupModules(visibleModules), [visibleModules]);
  const [activeModuleId, setActiveModuleId] = useState<PartsNavigationModuleId>(initialModuleId);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navSwitchMs, setNavSwitchMs] = useState(0);
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [menuOrientation, setMenuOrientation] = useState<'vertical' | 'horizontal'>('vertical');

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
  const quickAccessModules = visibleModules.slice(0, 4);

  const handleModuleChange = (moduleId: PartsNavigationModuleId) => {
    setActiveModuleId(moduleId);
    onModuleChange?.(moduleId);
    setMobileNavOpen(false);
  };

  const toggleGroup = (groupLabel: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupLabel]: !current[groupLabel],
    }));
  };

  const renderNavList = (compact = false) => (
    <div className={cn('space-y-3', compact ? '' : 'pr-1')}>
      {Object.entries(grouped).map(([groupLabel, modules]) => (
        <div key={groupLabel} className="space-y-1.5">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/40"
            onClick={() => toggleGroup(groupLabel)}
            aria-expanded={!collapsedGroups[groupLabel]}
          >
            {collapsedGroups[groupLabel] ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <span>{groupLabel}</span>
          </button>
          <div className={cn('space-y-1', collapsedGroups[groupLabel] ? 'hidden' : '')}>
            {modules.map((module) => {
              const active = module.id === activeModuleId;
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => handleModuleChange(module.id)}
                  className={cn(
                    'w-full rounded-md border px-2.5 py-2 text-left transition',
                    active
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{module.label}</span>
                    <Badge variant={active ? 'default' : 'outline'} className="text-[10px]">
                      {module.shortcut}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{module.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const renderHorizontalMenu = () => (
    <Card className="mb-3 hidden md:block">
      <CardContent className="p-2">
        <ScrollArea className="w-full">
          <div className="flex min-w-max items-center gap-2">
            {visibleModules.map((module) => (
              <Button
                key={`horizontal-module-${module.id}`}
                type="button"
                variant={module.id === activeModuleId ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleModuleChange(module.id)}
              >
                {module.label}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3">
      <Card className="border-slate-300">
        <CardContent className="space-y-3 p-3">
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
              <Badge variant={navSwitchMs <= 200 ? 'secondary' : 'destructive'} className="text-[10px]">
                Nav Response {navSwitchMs}ms
              </Badge>
              <Badge variant="outline" className="text-[10px]">{activeRole}</Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="hidden md:inline-flex"
                onClick={() => setMenuOrientation((value) => (value === 'vertical' ? 'horizontal' : 'vertical'))}
              >
                <Rows3 className="mr-1 h-4 w-4" />
                {menuOrientation === 'vertical' ? 'Horizontal Menu' : 'Vertical Menu'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="hidden md:inline-flex"
                onClick={() => setMenuCollapsed((value) => !value)}
                aria-label={menuCollapsed ? 'Expand module menu' : 'Collapse module menu'}
              >
                {menuCollapsed ? <PanelLeftOpen className="mr-1 h-4 w-4" /> : <PanelLeftClose className="mr-1 h-4 w-4" />}
                {menuCollapsed ? 'Expand Menu' : 'Collapse Menu'}
              </Button>
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button type="button" size="sm" variant="outline" className="md:hidden">
                    <Menu className="mr-1 h-4 w-4" />
                    Modules
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[88vw] max-w-sm">
                  <SheetHeader>
                    <SheetTitle>Parts Modules</SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="mt-3 h-[calc(100vh-96px)] pr-2">
                    {renderNavList(true)}
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs text-muted-foreground">Quick Access</p>
            {quickAccessModules.map((module) => (
              <Button
                key={`quick-${module.id}`}
                type="button"
                variant={module.id === activeModuleId ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleModuleChange(module.id)}
              >
                {module.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className={cn('grid grid-cols-1 gap-3', menuOrientation === 'vertical' && !menuCollapsed ? 'md:grid-cols-[280px_1fr]' : 'md:grid-cols-1')}>
        {menuOrientation === 'vertical' && !menuCollapsed ? (
        <Card className="hidden md:block">
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Module Menu</p>
              <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <ScrollArea className="h-[620px] pr-2">
              {renderNavList()}
            </ScrollArea>
          </CardContent>
        </Card>
        ) : null}
        <div aria-live="polite">
          {menuOrientation === 'horizontal' && !menuCollapsed ? renderHorizontalMenu() : null}
          {activeModule ? renderModule(activeModule.id) : renderModule('overview')}
        </div>
      </div>
    </div>
  );
}
