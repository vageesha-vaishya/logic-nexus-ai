export const tokens = {
  color: {
    primary: { value: '217 91% 60%' },
    primaryForeground: { value: '0 0% 100%' },
    secondary: { value: '210 40% 96%' },
    secondaryForeground: { value: '222 47% 11%' },
    danger: { value: '0 84% 60%' },
    dangerForeground: { value: '0 0% 100%' },
    success: { value: '142 71% 45%' },
    warning: { value: '38 92% 50%' },
    background: { value: '0 0% 100%' },
    foreground: { value: '222 47% 11%' },
    border: { value: '214 32% 91%' },
    muted: { value: '210 40% 96%' },
    mutedForeground: { value: '215 16% 47%' }
  },
  typography: {
    fontFamily: {
      sans: { value: '"Inter", "Segoe UI", "Roboto", sans-serif' },
      mono: { value: '"JetBrains Mono", "SFMono-Regular", monospace' }
    }
  },
  breakpoint: {
    mobile: { value: '375px' },
    tablet: { value: '768px' },
    desktop: { value: '1280px' }
  }
} as const;
