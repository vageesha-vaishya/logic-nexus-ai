import { SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { ObjectMenu } from './ObjectMenu';
import { Button } from '@/components/ui/button';
import { Bug, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStickyActions } from '@/components/layout/StickyActionsContext';
import { StickyActionsBar } from '@/components/ui/StickyActionsBar';
import { AdminScopeSwitcher } from './AdminScopeSwitcher';
import { DomainSwitcher } from '@/components/navigation/DomainSwitcher';
import { usePipeline } from '@/components/debug/pipeline/PipelineContext';
import { PipelineDashboard } from '@/components/debug/pipeline/PipelineDashboard';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { OnboardingTour } from '@/components/system/OnboardingTour';
import { HelpDialog } from '@/components/system/HelpDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function StickyActionsMount() {
  const { actions } = useStickyActions();
  return <StickyActionsBar left={actions.left} right={actions.right} />;
}

function PipelineTrigger() {
  const { toggleDashboard } = usePipeline();
  return (
    <Button variant="ghost" size="icon" onClick={toggleDashboard} title="Pipeline Debugger" aria-label="Pipeline Debugger">
      <Bug className="h-4 w-4" />
    </Button>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  useKeyboardShortcuts();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex w-full relative">
      <OnboardingTour />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>
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
          <HelpDialog />
          <PipelineTrigger />
          <DomainSwitcher />
          <AdminScopeSwitcher />
          <ObjectMenu />
        </header>
        <main id="main-content" className="flex-1 p-4 bg-muted/30 pb-24 outline-none" style={{ backgroundImage: 'var(--app-background, none)' }} tabIndex={-1}>
          <FeatureErrorBoundary featureName="Dashboard Content">
            {children}
          </FeatureErrorBoundary>
          <StickyActionsMount />
        </main>
      </div>
      <PipelineDashboard />
    </div>
  );
}
