// Typography scale for AMRO Parts Module
// Addresses Issue TY-03: Missing Font Weight Hierarchy
// All font sizes meet WCAG 2.1 AA minimum (12px/0.75rem)

export const typographyScale = {
  // Display (rarely used in AMRO Parts)
  'display-lg': { size: '2.25rem', weight: 700, lineHeight: '1.1' }, // 36px
  'display': { size: '1.875rem', weight: 700, lineHeight: '1.15' }, // 30px

  // Headings
  'h1': { size: '1.5rem', weight: 600, lineHeight: '1.2' }, // 24px - page titles
  'h2': { size: '1.25rem', weight: 600, lineHeight: '1.25' }, // 20px - section titles
  'h3': { size: '1.125rem', weight: 600, lineHeight: '1.3' }, // 18px - card titles

  // Body
  'body': { size: '0.875rem', weight: 400, lineHeight: '1.5' }, // 14px - standard text
  'body-sm': { size: '0.8125rem', weight: 400, lineHeight: '1.5' }, // 13px - secondary text

  // Data Display - MINIMUM 12px per WCAG
  'caption': { size: '0.75rem', weight: 400, lineHeight: '1.4' }, // 12px MINIMUM
  'overline': { size: '0.75rem', weight: 500, lineHeight: '1.4', letterSpacing: '0.05em' }, // labels

  // Numbers/Metrics
  'metric': { size: '1.875rem', weight: 700, lineHeight: '1.1' }, // KPI values
  'metric-label': { size: '0.75rem', weight: 500, lineHeight: '1.4' }, // KPI labels
} as const;

/**
 * Font weight usage guidelines:
 * - 400 (Regular): Body text, descriptions, help text
 * - 500 (Medium): Labels, metadata, secondary emphasis
 * - 600 (Semibold): Headings, interactive elements
 * - 700 (Bold): Metrics, primary emphasis
 */

/**
 * Line height usage guidelines:
 * - leading-none (1.0): Large metrics (2xl+)
 * - leading-tight (1.25): Headings
 * - leading-snug (1.375): Dense data (xs text)
 * - leading-normal (1.5): Body text
 */
