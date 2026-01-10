import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { ObjectMenu } from './ObjectMenu';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StickyActionsProvider, useStickyActions } from '@/components/layout/StickyActionsContext';
import { StickyActionsBar } from '@/components/ui/StickyActionsBar';
import { AdminScopeSwitcher } from './AdminScopeSwitcher';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function StickyActionsMount() {
  const { actions } = useStickyActions();
  return <StickyActionsBar left={actions.left} right={actions.right} />;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  return (
    <SidebarProvider>
      <StickyActionsProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <header className="h-12 border-b flex items-center px-3 gap-3 bg-background sticky top-0 z-10">
              <SidebarTrigger />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Go back"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1" />
              <AdminScopeSwitcher />
              <ObjectMenu />
            </header>
            <main className="flex-1 p-4 bg-muted/30 pb-24" style={{ backgroundImage: 'var(--app-background, none)' }}>
              {children}
              <StickyActionsMount />
            </main>
          </div>
        </div>
      </StickyActionsProvider>
    </SidebarProvider>
  );
}
