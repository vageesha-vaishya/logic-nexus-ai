import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { ObjectMenu } from './ObjectMenu';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 border-b flex items-center px-3 gap-3 bg-background sticky top-0 z-10">
            <SidebarTrigger />
            <ObjectMenu />
          </header>
          <main className="flex-1 p-4 bg-muted/30" style={{ backgroundImage: 'var(--app-background, none)' }}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
