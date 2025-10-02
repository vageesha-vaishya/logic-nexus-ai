import { Link } from 'react-router-dom';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuList, NavigationMenuTrigger, NavigationMenuLink } from '@/components/ui/navigation-menu';
import { OBJECT_GROUPS } from '@/config/object-groups';

export function ObjectMenu() {
  return (
    <NavigationMenu className="ml-2">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>
            App Launcher
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            {/* Wide, responsive mega-menu viewport to avoid the narrow column */}
            <div className="w-[92vw] max-w-[1000px] sm:w-[640px] lg:w-[900px] p-4 sm:p-6">
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