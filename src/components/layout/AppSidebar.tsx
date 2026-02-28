import { Home, LogOut, Loader2, Menu } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import Logo from '@/components/branding/Logo';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  useSidebar,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CommandCenterButton } from '@/components/navigation/CommandCenterButton';
import { CommandCenterNav } from '@/components/navigation/CommandCenterNav';
import { motion } from 'framer-motion';

export function AppSidebar() {
  const { state, setOpen, isMobile, setOpenMobile } = useSidebar();
  const { signOut, profile } = useAuth();
  
  // Force collapsed state on initial load
  // useEffect(() => {
  //   // Ensure we start collapsed
  //   if (state !== 'collapsed' && !isMobile) {
  //     setOpen(false);
  //   }
  // }, []);

  const collapsed = state === 'collapsed';
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const { error } = await signOut();
      if (error) {
        toast.error("Sign out failed, but you have been logged out locally.");
      }
    } catch (e) {
      console.error(e);
      toast.error("An unexpected error occurred during sign out.");
    } finally {
      setIsSigningOut(false);
    }
  };

  // Restore saved scroll position on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('sidebar:scrollTop');
    const el = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    if (el && saved) {
      el.scrollTop = Number(saved);
    }
  }, []);

  // Persist scroll position during scrolling
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    if (!el) return;
    const handler = () => sessionStorage.setItem('sidebar:scrollTop', String(el.scrollTop));
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, []);

  // Ensure active item stays in view after navigation
  useEffect(() => {
    // Small timeout to allow collapsible sections to expand/render
    const timer = setTimeout(() => {
      const container = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
      if (!container) return;
      const activeLink = container.querySelector('a[aria-current="page"]') as HTMLElement | null;
      if (activeLink) {
        const linkRect = activeLink.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        const outOfView = linkRect.top < contRect.top || linkRect.bottom > contRect.bottom;
        if (outOfView) {
          activeLink.scrollIntoView({ block: 'nearest' });
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [location]);

  return (
    <>
      <CommandCenterButton />
      
      {/* Semi-transparent backdrop for mobile/expanded state */}
      {!collapsed && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => isMobile ? setOpenMobile(false) : setOpen(false)}
        />
      )}

      <Sidebar 
        className={cn(
          "border-r transition-all duration-300 ease-[cubic-bezier(0.4,0.0,0.2,1)] z-50",
          collapsed ? 'w-0 -translate-x-full lg:w-[60px] lg:translate-x-0 overflow-hidden' : 'w-[280px] translate-x-0'
        )} 
        collapsible="icon"
      >
        <SidebarHeader className="h-16 flex items-center justify-between px-4 border-b">
          {!collapsed && (
             <div className="flex items-center gap-2">
               <Logo size={32} showWordmark wordmarkClassName="hidden sm:block" />
             </div>
          )}
          {collapsed && (
            <div className="flex w-full justify-center">
              <Logo size={24} />
            </div>
          )}
        </SidebarHeader>

        <SidebarContent ref={scrollRef} className="py-2">
          <CommandCenterNav />
        </SidebarContent>

      <SidebarFooter className="border-t p-4">
        {!collapsed && profile && (
          <div className="mb-3 space-y-1">
            <p className="text-sm font-medium truncate">
              {profile.first_name} {profile.last_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className="w-full justify-start"
          onClick={handleSignOut}
          disabled={isSigningOut}
          aria-label={collapsed ? "Sign Out" : undefined}
        >
          {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          {!collapsed && <span className="ml-2">{isSigningOut ? 'Signing Out...' : 'Sign Out'}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
    </>
  );
}
