/**
 * AMRO Design Tokens - Typography Scale (1.25x Major Third Ratio)
 * 
 * Mathematical progression: each level is 1.25x the previous level
 * H1: 2.44rem (39.04px)
 * H2: 1.95rem (31.2px)
 * H3: 1.56rem (24.96px)
 * H4: 1.25rem (20px)
 * H5: 1rem (16px)
 * H6: 0.8rem (12.8px)
 * 
 * Font Family: Inter (primary), system-ui (fallback)
 * Line Heights: 1.2 for headings, 1.5 for body text
 */

export const amroTypography = {
  fontFamily: {
    primary: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },

  // Heading Scale (1.25x Major Third Ratio)
  headings: {
    h1: {
      fontSize: '2.44rem',      // 39.04px
      lineHeight: 1.2,
      fontWeight: 700,          // bold
      letterSpacing: '-0.025em',
      textTransform: 'none' as const,
    },
    h2: {
      fontSize: '1.95rem',      // 31.2px
      lineHeight: 1.2,
      fontWeight: 700,          // bold
      letterSpacing: '-0.025em',
      textTransform: 'none' as const,
    },
    h3: {
      fontSize: '1.56rem',      // 24.96px
      lineHeight: 1.2,
      fontWeight: 600,          // semibold
      letterSpacing: '-0.0125em',
      textTransform: 'none' as const,
    },
    h4: {
      fontSize: '1.25rem',      // 20px
      lineHeight: 1.2,
      fontWeight: 600,          // semibold
      letterSpacing: '0em',
      textTransform: 'none' as const,
    },
    h5: {
      fontSize: '1rem',         // 16px
      lineHeight: 1.2,
      fontWeight: 600,          // semibold
      letterSpacing: '0.025em',
      textTransform: 'none' as const,
    },
    h6: {
      fontSize: '0.8rem',       // 12.8px
      lineHeight: 1.2,
      fontWeight: 600,          // semibold
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
    },
  },

  // Body Text
  body: {
    lg: {
      fontSize: '1.125rem',     // 18px
      lineHeight: 1.5,
      fontWeight: 400,          // regular
    },
    base: {
      fontSize: '1rem',         // 16px
      lineHeight: 1.5,
      fontWeight: 400,          // regular
    },
    sm: {
      fontSize: '0.875rem',     // 14px
      lineHeight: 1.5,          // 21px
      fontWeight: 400,          // regular
    },
    xs: {
      fontSize: '0.75rem',      // 12px
      lineHeight: 1.5,
      fontWeight: 400,          // regular
    },
  },

  // Data Grid Typography
  dataGrid: {
    header: {
      fontSize: '1rem',         // 16px
      lineHeight: 1.25,
      fontWeight: 600,          // semibold
    },
    body: {
      fontSize: '0.875rem',     // 14px
      lineHeight: '1.4285',     // 20px
      fontWeight: 400,          // regular
    },
    pagination: {
      fontSize: '0.875rem',     // 14px
      lineHeight: 1.5,
      fontWeight: 500,          // medium
    },
    caption: {
      fontSize: '0.75rem',      // 12px
      lineHeight: 1.5,
      fontWeight: 400,          // regular
    },
  },

  // Form Typography
  form: {
    label: {
      fontSize: '0.875rem',     // 14px
      lineHeight: 1.5,
      fontWeight: 500,          // medium
    },
    helper: {
      fontSize: '0.75rem',      // 12px
      lineHeight: 1.5,
      fontWeight: 400,          // regular
    },
    error: {
      fontSize: '0.75rem',      // 12px
      lineHeight: 1.5,
      fontWeight: 500,          // medium
    },
  },

  // Button Typography
  buttons: {
    primary: {
      fontSize: '0.875rem',     // 14px
      lineHeight: 1.5,
      fontWeight: 500,          // medium
    },
    secondary: {
      fontSize: '0.8125rem',    // 13px
      lineHeight: 1.5,
      fontWeight: 500,          // medium
    },
  },
} as const;

export type AmroTypography = typeof amroTypography;
export type AmroHeadingLevel = keyof typeof amroTypography.headings;
