import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from '@/components/ui/navigation-menu';
import { OBJECT_GROUPS } from '@/config/object-groups';
import { useSystemLogger } from '@/hooks/useSystemLogger';

export function ObjectMenu() {
  const systemLogger = useSystemLogger('ObjectMenu');
  const launcherValue = 'app-launcher';
  const openDelayRef = useRef<number | null>(null);
  const closeDelayRef = useRef<number | null>(null);
  const [menuValue, setMenuValue] = useState('');
  const [clickPinned, setClickPinned] = useState(false);
  const hoverOpenDelayMs = 80;
  const hoverCloseDelayMs = 120;

  const clearOpenDelay = () => {
    if (openDelayRef.current !== null) {
      window.clearTimeout(openDelayRef.current);
      openDelayRef.current = null;
    }
  };

  const clearCloseDelay = () => {
    if (closeDelayRef.current !== null) {
      window.clearTimeout(closeDelayRef.current);
      closeDelayRef.current = null;
    }
  };

  const clearTimers = () => {
    clearOpenDelay();
    clearCloseDelay();
  };

  const closeMenu = () => {
    setMenuValue('');
    setClickPinned(false);
    clearTimers();
  };

  const scheduleHoverOpen = () => {
    if (typeof window === 'undefined') {
      return;
    }
    clearCloseDelay();
    if (clickPinned) {
      return;
    }
    try {
      clearOpenDelay();
      openDelayRef.current = window.setTimeout(() => {
        setMenuValue(launcherValue);
      }, hoverOpenDelayMs);
    } catch (error) {
      systemLogger.warn('Failed to schedule launcher open', {
        component: 'ObjectMenu',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const scheduleHoverClose = () => {
    if (typeof window === 'undefined') {
      return;
    }
    clearOpenDelay();
    if (clickPinned) {
      return;
    }
    clearCloseDelay();
    closeDelayRef.current = window.setTimeout(() => {
      setMenuValue((currentValue) => (currentValue === launcherValue ? '' : currentValue));
    }, hoverCloseDelayMs);
  };

  const handleTriggerClick = () => {
    clearTimers();
    setMenuValue((current) => {
      const isOpen = current === launcherValue;
      if (isOpen) {
        setClickPinned(false);
        return '';
      }
      setClickPinned(true);
      return launcherValue;
    });
  };

  const handleTriggerPointerDown = (pointerType: string) => {
    if (pointerType === 'mouse') {
      return;
    }
    clearTimers();
    setClickPinned(true);
    setMenuValue(launcherValue);
  };

  const handleTriggerKeyDown = (key: string) => {
    if (key === 'Enter' || key === ' ') {
      setClickPinned(true);
      setMenuValue(launcherValue);
      return;
    }
    if (key === 'Escape') {
      closeMenu();
    }
  };

  const handleMenuValueChange = (value: string) => {
    setMenuValue(value);
    if (value !== launcherValue) {
      setClickPinned(false);
      clearTimers();
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  const handlePointerEnter = (pointerType: string) => {
    if (pointerType !== 'mouse') {
      return;
    }
    scheduleHoverOpen();
  };

  const handlePointerLeave = (pointerType: string) => {
    if (pointerType !== 'mouse') {
      return;
    }
    scheduleHoverClose();
  };

  const handlePointerCancel = () => {
    clearTimers();
  };

  return (
    <NavigationMenu className="ml-2" value={menuValue} onValueChange={handleMenuValueChange}>
      <NavigationMenuList>
        <NavigationMenuItem value={launcherValue}>
          <NavigationMenuTrigger
            onClick={handleTriggerClick}
            onPointerDown={(event) => handleTriggerPointerDown(event.pointerType)}
            onPointerEnter={(event) => handlePointerEnter(event.pointerType)}
            onPointerLeave={(event) => handlePointerLeave(event.pointerType)}
            onPointerCancel={handlePointerCancel}
            onKeyDown={(event) => handleTriggerKeyDown(event.key)}
          >
            App Launcher
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div
              data-testid="app-launcher-content"
              onPointerEnter={(event) => handlePointerEnter(event.pointerType)}
              onPointerLeave={(event) => handlePointerLeave(event.pointerType)}
              onPointerCancel={handlePointerCancel}
              className="w-[92vw] max-w-[1000px] sm:w-[640px] lg:w-[900px] p-4 sm:p-6 max-h-[min(78vh,720px)] overflow-y-auto overflow-x-hidden [transform:translateZ(0)]"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {OBJECT_GROUPS.map((group) => (
                  <div key={group.label} className="space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      {group.label}
                    </div>
                    <ul className="space-y-2">
                      {group.items.map((item) => (
                        <li key={item.name}>
                          <NavigationMenuLink asChild>
                            <Link
                              to={item.to}
                              onClick={closeMenu}
                              className="flex items-center gap-3 rounded-md border border-transparent px-3 py-2 hover:bg-muted hover:text-foreground hover:border-border transition"
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{item.name}</p>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                                )}
                              </div>
                              {item.badge && (
                                <span className="ml-auto text-[10px] rounded bg-muted px-2 py-0.5 text-muted-foreground">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
