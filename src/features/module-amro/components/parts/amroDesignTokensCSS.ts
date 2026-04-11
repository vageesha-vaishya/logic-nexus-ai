/**
 * AMRO Design Tokens - CSS Custom Properties
 * 
 * Typography Scale (1.25x Major Third Ratio)
 * Spacing System (8px Grid)
 * Layout System (12-column Grid)
 * Semantic Colors
 * 
 * Import this file in your component to access CSS variables
 */

export const amroDesignTokensCSS = `
:root {
  /* ==========================================================================
     TYPOGRAPHY SCALE - Major Third (1.25x Ratio)
     ========================================================================== */
  
  /* Heading Sizes */
  --amro-h1-size: 2.44rem;      /* 39.04px - Page titles */
  --amro-h2-size: 1.95rem;      /* 31.2px - Section headers */
  --amro-h3-size: 1.56rem;      /* 24.96px - Card titles */
  --amro-h4-size: 1.25rem;      /* 20px - Subsection headers */
  --amro-h5-size: 1rem;         /* 16px - Field group headers */
  --amro-h6-size: 0.8rem;       /* 12.8px - Labels, captions, badges */

  /* Body Text Sizes */
  --amro-text-lg: 1.125rem;     /* 18px */
  --amro-text-base: 1rem;       /* 16px */
  --amro-text-sm: 0.875rem;     /* 14px - Body standard */
  --amro-text-xs: 0.75rem;      /* 12px */

  /* Data Grid Typography */
  --amro-grid-header-size: 1rem;         /* 16px, semibold */
  --amro-grid-body-size: 0.875rem;       /* 14px, regular */
  --amro-grid-line-height: 1.4285;       /* 20px line height */
  --amro-grid-pagination-size: 0.875rem; /* 14px, medium */

  /* Line Heights */
  --amro-leading-heading: 1.2;
  --amro-leading-body: 1.5;
  --amro-leading-tight: 1.25;
  --amro-leading-snug: 1.375;
  --amro-leading-relaxed: 1.625;

  /* Font Weights */
  --amro-font-regular: 400;
  --amro-font-medium: 500;
  --amro-font-semibold: 600;
  --amro-font-bold: 700;

  /* Letter Spacing */
  --amro-tracking-tight: -0.025em;
  --amro-tracking-normal: 0em;
  --amro-tracking-wide: 0.025em;
  --amro-tracking-wider: 0.05em;

  /* Font Families */
  --amro-font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --amro-font-mono: 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* ==========================================================================
     SPACING SYSTEM - 8px Grid
     All spacing values are multiples of 8px
     ========================================================================== */
  
  --amro-space-1: 0.25rem;      /* 4px */
  --amro-space-2: 0.5rem;       /* 8px */
  --amro-space-3: 0.75rem;      /* 12px */
  --amro-space-4: 1rem;         /* 16px */
  --amro-space-5: 1.25rem;      /* 20px */
  --amro-space-6: 1.5rem;       /* 24px */
  --amro-space-8: 2rem;         /* 32px */
  --amro-space-10: 2.5rem;      /* 40px */
  --amro-space-12: 3rem;        /* 48px */
  --amro-space-16: 4rem;        /* 64px */
  --amro-space-20: 5rem;        /* 80px */
  --amro-space-24: 6rem;        /* 96px */

  /* Component Spacing */
  --amro-cell-padding-x: 0.75rem;    /* 12px horizontal */
  --amro-cell-padding-y: 0.5rem;     /* 8px vertical */
  --amro-section-gap: 2rem;          /* 32px between sections */
  --amro-card-padding: 1.5rem;       /* 24px */
  --amro-form-gap: 1rem;             /* 16px between form fields */
  --amro-button-gap: 0.5rem;         /* 8px between buttons */

  /* ==========================================================================
     LAYOUT SYSTEM - 12-Column Grid
     ========================================================================== */
  
  /* Container Margins by Breakpoint */
  --amro-margin-xl: 1.5rem;     /* 24px - 1440px+ */
  --amro-margin-lg: 1rem;       /* 16px - 1024-1439px */
  --amro-margin-md: 0.75rem;    /* 12px - 768-1023px */
  --amro-margin-sm: 0.5rem;     /* 8px - 320-767px */

  /* Gutter Widths */
  --amro-gutter-desktop: 1.5rem;   /* 24px */
  --amro-gutter-tablet: 1rem;      /* 16px */
  --amro-gutter-mobile: 0.75rem;   /* 12px */

  /* Grid Configuration */
  --amro-grid-columns: 12;
  --amro-grid-gap: 1.5rem;         /* 24px */
  
  /* Container Max Widths */
  --amro-container-sm: 640px;
  --amro-container-md: 768px;
  --amro-container-lg: 1024px;
  --amro-container-xl: 1280px;     /* Max content width */

  /* Section Padding by Breakpoint */
  --amro-section-padding-desktop: 2rem;    /* 32px */
  --amro-section-padding-tablet: 1.5rem;   /* 24px */
  --amro-section-padding-mobile: 1rem;     /* 16px */

  /* ==========================================================================
     BUTTON SPECIFICATIONS
     ========================================================================== */
  
  /* Primary CTA Buttons */
  --amro-btn-primary-height: 2.5rem;     /* 40px */
  --amro-btn-primary-min-width: 7.5rem;  /* 120px */
  --amro-btn-primary-padding-x: 1.5rem;  /* 24px */
  --amro-btn-primary-padding-y: 0.5rem;  /* 8px */

  /* Secondary Action Buttons */
  --amro-btn-secondary-height: 2.25rem;  /* 36px */
  --amro-btn-secondary-min-width: 6.25rem; /* 100px */
  --amro-btn-secondary-padding-x: 1rem;  /* 16px */
  --amro-btn-secondary-padding-y: 0.375rem; /* 6px */

  /* Touch Targets (Accessibility) */
  --amro-touch-target-min: 2.75rem;      /* 44px - WCAG 2.1 AA */

  /* ==========================================================================
     DATA GRID SPECIFICATIONS
     ========================================================================== */
  
  /* Cell Sizing */
  --amro-grid-cell-padding-x: 0.75rem;   /* 12px */
  --amro-grid-cell-padding-y: 0.5rem;    /* 8px */
  --amro-grid-header-padding-x: 0.75rem; /* 12px */
  --amro-grid-header-padding-y: 0.5rem;  /* 8px */

  /* Borders */
  --amro-grid-border-color: #E5E7EB;
  --amro-grid-border-width: 1px;

  /* Pagination */
  --amro-pagination-gap: 0.5rem;         /* 8px between page numbers */
  --amro-pagination-margin: 1rem;        /* 16px from grid edge */

  /* Sort Icons */
  --amro-sort-icon-size: 1rem;           /* 16x16px */

  /* ==========================================================================
     SEMANTIC COLORS
     ========================================================================== */
  
  /* Status Colors */
  --amro-color-success: #10b981;
  --amro-color-warning: #f59e0b;
  --amro-color-error: #ef4444;
  --amro-color-info: #3b82f6;
  --amro-color-neutral: #6b7280;

  /* Background Tints */
  --amro-bg-success: #d1fae5;
  --amro-bg-warning: #fef3c7;
  --amro-bg-error: #fee2e2;
  --amro-bg-info: #dbeafe;
  --amro-bg-neutral: #f3f4f6;

  /* Form Action Bar */
  --amro-form-action-margin: 1.5rem;     /* 24px from container edge */
  --amro-form-action-gap: 0.5rem;        /* 8px between buttons */

  /* ==========================================================================
     VISUAL DECLUTTERING
     ========================================================================== */
  
  /* Subtle Shadows (replacing borders) */
  --amro-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --amro-shadow-md: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --amro-shadow-lg: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);

  /* Border Radius */
  --amro-radius-sm: 0.25rem;    /* 4px */
  --amro-radius-md: 0.375rem;   /* 6px */
  --amro-radius-lg: 0.5rem;     /* 8px */
  --amro-radius-xl: 0.75rem;    /* 12px */

  /* Transitions */
  --amro-transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --amro-transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --amro-transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
`;

export default amroDesignTokensCSS;
