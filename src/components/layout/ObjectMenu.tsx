import { useRef } from 'react';
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

export function ObjectMenu() {
  const timeoutRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const initialScrollRef = useRef<number | null>(null);
  const hoverCountRef = useRef(0);

  const clearTimers = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  const smoothScrollTo = (targetX: number, duration: number) => {
    const startX = window.scrollX;
    const distance = targetX - startX;
    const startTime = performance.now();

    if (Math.abs(distance) < 1) return;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-in-out function
      const ease =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          
      const nextX = startX + distance * ease;

      window.scrollTo(nextX, window.scrollY);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const computeTargetScrollX = () => {
    const maxScrollX = document.documentElement.scrollWidth - window.innerWidth;

    if (!contentRef.current) {
      return Math.max(0, maxScrollX);
    }

    const rect = contentRef.current.getBoundingClientRect();
    const overflowRight = rect.right - window.innerWidth;

    if (overflowRight <= 0) {
      // Popup already fully visible; no extra scroll
      return window.scrollX;
    }

    const desired = window.scrollX + overflowRight;
    return Math.min(Math.max(0, desired), Math.max(0, maxScrollX));
  };

  const handleMouseEnter = () => {
    clearTimers();

    // Save the original scroll position once per hover cycle
    if (initialScrollRef.current === null) {
      initialScrollRef.current = window.scrollX;
    }

    timeoutRef.current = window.setTimeout(() => {
      const targetX = computeTargetScrollX();
      smoothScrollTo(targetX, 300);
    }, 100);
  };

  const handleMouseLeave = () => {
    clearTimers();

    const targetX = initialScrollRef.current ?? 0;

    timeoutRef.current = window.setTimeout(() => {
      smoothScrollTo(targetX, 300);
      initialScrollRef.current = null;
    }, 100);
  };

  const handleRegionEnter = () => {
    hoverCountRef.current += 1;
    if (hoverCountRef.current === 1) {
      handleMouseEnter();
    }
  };

  const handleRegionLeave = () => {
    hoverCountRef.current = Math.max(hoverCountRef.current - 1, 0);
    if (hoverCountRef.current === 0) {
      handleMouseLeave();
    }
  };

  return (
    <NavigationMenu className="ml-2">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger
            onMouseEnter={handleRegionEnter}
            onMouseLeave={handleRegionLeave}
          >
            App Launcher
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            {/* Wide, responsive mega-menu viewport to avoid the narrow column */}
            <div
              ref={contentRef}
              onMouseEnter={handleRegionEnter}
              onMouseLeave={handleRegionLeave}
              className="w-[92vw] max-w-[1000px] sm:w-[640px] lg:w-[900px] p-4 sm:p-6"
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
