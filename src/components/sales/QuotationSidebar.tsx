import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Package, 
  BarChart3, 
  Plus, 
  Upload, 
  FileDown, 
  Mail, 
  Calculator, 
  TrendingUp, 
  History, 
  Copy, 
  ChevronRight, 
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLocation, useNavigate } from 'react-router-dom';

// Design Tokens (mapped to Tailwind classes)
// --nexus-primary-500: text-primary (using css var)
// animation: duration-300 ease-in-out

interface SidebarItem {
  label: string;
  icon: React.ElementType;
  action?: () => void;
  path?: string;
  badge?: number;
  shortcut?: string;
}

interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

export function QuotationSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State Management
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem('nexus:quotes:sidebar');
    return saved === 'true';
  });

  const toggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    localStorage.setItem('nexus:quotes:sidebar', String(newState));
  };

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        toggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const GROUPS: SidebarGroup[] = [
    {
      title: 'Navigation',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/sales' },
        { label: 'Quotations', icon: FileText, path: '/dashboard/quotes/pipeline', badge: 3 },
        { label: 'Customers', icon: Users, path: '/dashboard/contacts' },
        { label: 'Products', icon: Package, path: '/dashboard/products' },
        { label: 'Reports', icon: BarChart3, path: '/dashboard/reports/sales' },
      ]
    },
    {
      title: 'Quick Actions',
      items: [
        { label: 'New Quote', icon: Plus, action: () => navigate('/dashboard/quotes/new'), shortcut: '⌘+N' },
        { label: 'Import CSV', icon: Upload, action: () => console.log('Import') },
        { label: 'Export PDF', icon: FileDown, action: () => console.log('Export') },
        { label: 'Send Bulk Email', icon: Mail, action: () => console.log('Email') },
      ]
    },
    {
      title: 'Module Tools',
      items: [
        { label: 'Discount Calculator', icon: Calculator, action: () => console.log('Calc') },
        { label: 'Margin Analyzer', icon: TrendingUp, action: () => console.log('Margin') },
        { label: 'Price History', icon: History, action: () => console.log('History') },
        { label: 'Duplicate Checker', icon: Copy, action: () => console.log('Dedup') },
      ]
    }
  ];

  return (
    <div 
      className={cn(
        "relative flex flex-col border-r bg-background transition-[width] duration-300 ease-in-out h-[calc(100vh-3.5rem)]", // Adjust height for header
        isOpen ? "w-[280px]" : "w-[48px]"
      )}
      role="navigation"
      aria-expanded={isOpen}
    >
      {/* Trigger Tab */}
      <button
        onClick={toggle}
        className={cn(
          "absolute -right-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary",
          "transition-transform duration-300 ease-in-out"
        )}
        aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      {/* Content Container */}
      <div className="flex-1 overflow-hidden">
        <div className={cn(
          "flex h-full w-[280px] flex-col gap-6 p-4 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          {GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = item.path ? location.pathname === item.path : false;
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        if (item.path) navigate(item.path);
                        if (item.action) item.action();
                        if (window.innerWidth <= 768) toggle(); // Auto-close on mobile
                      }}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                        isActive && "bg-primary/10 text-primary border-l-4 border-primary pl-1" // Active state adjustment
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
                          {item.badge}
                        </span>
                      )}
                      {item.shortcut && (
                        <span className="hidden text-xs text-muted-foreground lg:inline-block">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Collapsed State Icons (Optional - strictly requested to replace button, but persistent tab implies visibility) */}
      {!isOpen && (
        <div className="absolute inset-0 flex flex-col items-center pt-16 gap-4">
           {/* We could show icons here for quick access in collapsed mode, 
               but the prompt emphasized the persistent trigger. 
               The 48px width is mainly for the trigger area or collapsed view. 
               Let's show the top icons for visual cue. */}
           {GROUPS[0].items.slice(0, 4).map((item) => (
             <div key={item.label} className="h-10 w-10 flex items-center justify-center text-muted-foreground">
               <item.icon className="h-5 w-5" />
             </div>
           ))}
        </div>
      )}
    </div>
  );
}
