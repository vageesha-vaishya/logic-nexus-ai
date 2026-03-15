import type { Meta, StoryObj } from '@storybook/react-vite';
import { action } from 'storybook/actions';
import { useEffect, useState, type MouseEvent, type PropsWithChildren } from 'react';
import { QuoteManagerDashboard } from './QuoteManagerDashboard';
import { BrowserRouter, useLocation, useNavigationType } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { CRMProvider } from '@/hooks/useCRM';
import { AppSidebar } from '@/components/layout/AppSidebar';

const logMenuClick = action('menu-click');
const logRouteChange = action('route-change');

function StorybookNavigationEvents({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [lastMenuEvent, setLastMenuEvent] = useState<{ label: string; href: string; currentPath: string } | null>(null);
  const [lastRouteEvent, setLastRouteEvent] = useState<{ pathname: string; search: string; navigationType: string } | null>(null);

  useEffect(() => {
    const routeEvent = {
      pathname: location.pathname,
      search: location.search,
      navigationType,
    };
    logRouteChange(routeEvent);
    setLastRouteEvent(routeEvent);
  }, [location.pathname, location.search, navigationType]);

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const link = target?.closest('a[href]');
    if (!link) return;

    const menuEvent = {
      label: link.textContent?.trim() || link.getAttribute('aria-label') || 'unknown',
      href: link.getAttribute('href') || '',
      currentPath: location.pathname,
    };
    logMenuClick(menuEvent);
    setLastMenuEvent(menuEvent);
  };

  return (
    <div onClickCapture={onClickCapture}>
      {children}
      <div className="fixed right-3 bottom-3 z-[80] pointer-events-none">
        <div className="w-[320px] rounded-md border bg-background/95 backdrop-blur shadow-md p-3 space-y-2 text-xs">
          <div className="font-medium text-foreground">Storybook Event HUD</div>
          <div className="text-muted-foreground">
            Route: {lastRouteEvent ? `${lastRouteEvent.pathname}${lastRouteEvent.search} (${lastRouteEvent.navigationType})` : 'none'}
          </div>
          <div className="text-muted-foreground">
            Menu: {lastMenuEvent ? `${lastMenuEvent.label} → ${lastMenuEvent.href}` : 'none'}
          </div>
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof QuoteManagerDashboard> = {
  title: 'Dashboard/Sales/QuoteManagerDashboard',
  component: QuoteManagerDashboard,
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      const useMockData = context.parameters?.useMockData === true || context.globals?.dataMode === 'mock';
      if (typeof document !== 'undefined') {
        document.cookie = 'sidebar:state=true; path=/';
      }

      if (useMockData) {
        return (
          <BrowserRouter>
            <StorybookNavigationEvents>
              <AuthProvider>
                <CRMProvider>
                  <div className="relative flex min-h-screen w-full overflow-hidden">
                    <AppSidebar />
                    <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-6 bg-muted/30" style={{ backgroundImage: 'var(--app-background, none)' }}>
                      <Story />
                    </main>
                  </div>
                </CRMProvider>
              </AuthProvider>
            </StorybookNavigationEvents>
          </BrowserRouter>
        );
      }

      return (
        <BrowserRouter>
          <StorybookNavigationEvents>
            <AuthProvider>
              <CRMProvider>
                <div className="relative flex min-h-screen w-full overflow-hidden">
                  <AppSidebar />
                  <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-6 bg-muted/30" style={{ backgroundImage: 'var(--app-background, none)' }}>
                    <Story />
                  </main>
                </div>
              </CRMProvider>
            </AuthProvider>
          </StorybookNavigationEvents>
        </BrowserRouter>
      );
    },
  ],
  parameters: {
    layout: 'fullscreen',
    platformShell: true,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const FullWidth: Story = {
  args: {},
  parameters: {
    layout: 'fullscreen',
  },
};

export const MockData: Story = {
  name: 'MockData',
  args: {},
  parameters: {
    useMockData: true,
    layout: 'fullscreen',
  },
};

export const BaselineDesktopLive: Story = {
  name: 'Baseline/Desktop/Live',
  args: {},

  parameters: {
    layout: 'fullscreen'
  },

  globals: {
    viewport: {
      value: 'desktop',
      isRotated: false
    }
  }
};

export const BaselineTabletLive: Story = {
  name: 'Baseline/Tablet/Live',
  args: {},

  parameters: {
    layout: 'fullscreen'
  },

  globals: {
    viewport: {
      value: 'tablet',
      isRotated: false
    }
  }
};

export const BaselineMobileLive: Story = {
  name: 'Baseline/Mobile/Live',
  args: {},

  parameters: {
    layout: 'fullscreen'
  },

  globals: {
    viewport: {
      value: 'small',
      isRotated: false
    }
  }
};

export const BaselineDesktopMock: Story = {
  name: 'Baseline/Desktop/Mock',
  args: {},

  parameters: {
    useMockData: true,
    layout: 'fullscreen'
  },

  globals: {
    viewport: {
      value: 'desktop',
      isRotated: false
    }
  }
};

export const BaselineTabletMock: Story = {
  name: 'Baseline/Tablet/Mock',
  args: {},

  parameters: {
    useMockData: true,
    layout: 'fullscreen'
  },

  globals: {
    viewport: {
      value: 'tablet',
      isRotated: false
    }
  }
};

export const BaselineMobileMock: Story = {
  name: 'Baseline/Mobile/Mock',
  args: {},

  parameters: {
    useMockData: true,
    layout: 'fullscreen'
  },

  globals: {
    viewport: {
      value: 'small',
      isRotated: false
    }
  }
};
