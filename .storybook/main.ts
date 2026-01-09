import type { StorybookConfig } from '@storybook/react-vite';
import type { UserConfig } from 'vite';
import path from 'path';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.stories.@(ts|tsx|mdx)',
    '../docs/**/*.stories.@(mdx)'
  ],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-viewport'
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  docs: {
    defaultName: 'Docs'
  },
  viteFinal: async (config: UserConfig) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, '../src'),
    };
    config.optimizeDeps = {
      ...(config.optimizeDeps || {}),
      include: ['react', 'react-dom', '@tanstack/react-query'],
    };
    return config;
  },
};

export default config;
