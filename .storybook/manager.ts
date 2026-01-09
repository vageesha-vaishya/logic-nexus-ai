import { addons } from '@storybook/manager-api';
import { create } from '@storybook/theming/create';

const theme = create({
  base: 'light',
  brandTitle: 'SOS Logistics Pro Design System',
  brandUrl: 'https://soslogistics.example.com',
  brandImage: undefined,
  colorPrimary: '#3b82f6',
  colorSecondary: '#10b981',
});

addons.setConfig({
  theme,
});
