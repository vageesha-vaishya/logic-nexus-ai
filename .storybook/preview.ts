import React from 'react';
import '../src/index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '../src/components/ui/tooltip';
import { SidebarProvider } from '../src/components/ui/sidebar';
import { StickyActionsProvider } from '../src/components/layout/StickyActionsContext';
import { LeadsViewStateProvider } from '../src/hooks/useLeadsViewState';
import { PipelineProvider } from '../src/components/debug/pipeline/PipelineContext';
import { Toaster as Sonner } from '../src/components/ui/sonner';

const storybookQueryClient = new QueryClient();

const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    a11y: {
      config: {},
      options: {
        checks: { 'color-contrast': { options: { noScroll: true } } },
      },
    },
    viewport: {
      viewports: {
        small: { name: 'Small', styles: { width: '375px', height: '667px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1440px', height: '900px' } },
      },
      defaultViewport: 'desktop',
    },
    layout: 'fullscreen',
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'muted', value: 'hsl(var(--muted))' },
        { name: 'dark', value: '#0f172a' },
      ],
    },
    docs: {
      source: { type: 'dynamic' },
    },
  },
  globalTypes: {
    direction: {
      name: 'Text Direction',
      description: 'Toggle RTL/LTR layout direction',
      defaultValue: 'ltr',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
        ],
      },
    },
    locale: {
      name: 'Locale',
      description: 'Localization example locale',
      defaultValue: 'en-US',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'en-US', title: 'English (US)' },
          { value: 'ar-EG', title: 'Arabic (Egypt)' },
          { value: 'fr-FR', title: 'French (France)' },
        ],
      },
    },
    dataMode: {
      name: 'Data Mode',
      description: 'Switch between live providers and deterministic mock data',
      defaultValue: 'live',
      toolbar: {
        icon: 'database',
        items: [
          { value: 'live', title: 'Live' },
          { value: 'mock', title: 'Mock' },
        ],
      },
    },
  },
  decorators: [
    (Story: any, context: any) => {
      const dir = context.globals.direction || 'ltr';
      const platformShellEnabled = context.parameters?.platformShell !== false;
      const content = platformShellEnabled
        ? React.createElement(
            QueryClientProvider,
            { client: storybookQueryClient },
            React.createElement(
              TooltipProvider,
              null,
              React.createElement(
                SidebarProvider,
                null,
                React.createElement(
                  StickyActionsProvider,
                  null,
                  React.createElement(
                    LeadsViewStateProvider,
                    null,
                    React.createElement(
                      PipelineProvider,
                      null,
                      React.createElement(
                        'div',
                        {
                          className:
                            'min-h-screen bg-background text-foreground antialiased',
                          style: {
                            fontFamily: '"Inter", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
                            fontSize: '14px',
                            lineHeight: '1.4',
                          },
                        },
                        React.createElement(Story),
                        React.createElement(Sonner)
                      )
                    )
                  )
                )
              )
            )
          )
        : React.createElement(Story);
      return React.createElement(
        'div',
        { dir, 'data-locale': context.globals.locale },
        content
      );
    },
  ],
};

export default preview;
