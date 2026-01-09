import React from 'react';
import type { Preview } from '@storybook/react';
import '../src/index.css';

const preview: Preview = {
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
  },
  decorators: [
    (Story: any, context: any) => {
      const dir = context.globals.direction || 'ltr';
      return React.createElement(
        'div',
        { dir, 'data-locale': context.globals.locale },
        React.createElement(Story)
      );
    },
  ],
};

export default preview;
