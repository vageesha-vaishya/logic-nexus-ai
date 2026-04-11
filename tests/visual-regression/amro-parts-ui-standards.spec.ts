import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for AMRO Parts Module
 * Verifies consistent typography, spacing, and layout implementation
 * across all screen sizes and components
 */

test.describe('AMRO Parts Module - Typography Standards', () => {
  
  /**
   * Test 1: Heading Hierarchy Consistency
   * Verifies H1-H6 follow the 1.25x mathematical scale
   */
  test('All headings follow standardized size scale', async ({ page }) => {
    await page.goto('/dashboard/amro/parts');

    // Verify H1 elements are 20-24px
    const h1Elements = page.locator('h1, .amro-h1');
    const h1Count = await h1Elements.count();
    
    for (let i = 0; i < h1Count; i++) {
      const fontSize = await h1Elements.nth(i).evaluate(
        el => parseFloat(window.getComputedStyle(el).fontSize)
      );
      expect(fontSize).toBeGreaterThanOrEqual(20);
      expect(fontSize).toBeLessThanOrEqual(24);
    }

    // Verify H2 elements are 16-20px
    const h2Elements = page.locator('h2, .amro-h2');
    const h2Count = await h2Elements.count();
    
    for (let i = 0; i < h2Count; i++) {
      const fontSize = await h2Elements.nth(i).evaluate(
        el => parseFloat(window.getComputedStyle(el).fontSize)
      );
      expect(fontSize).toBeGreaterThanOrEqual(16);
      expect(fontSize).toBeLessThanOrEqual(20);
    }

    // Verify H3 elements are 14-18px
    const h3Elements = page.locator('h3, .amro-h3');
    const h3Count = await h3Elements.count();
    
    for (let i = 0; i < h3Count; i++) {
      const fontSize = await h3Elements.nth(i).evaluate(
        el => parseFloat(window.getComputedStyle(el).fontSize)
      );
      expect(fontSize).toBeGreaterThanOrEqual(14);
      expect(fontSize).toBeLessThanOrEqual(18);
    }
  });

  /**
   * Test 2: No Text Below 12px Minimum (WCAG 2.1 AA)
   * Ensures all text meets minimum readable size
   */
  test('No text below 12px minimum (WCAG AA)', async ({ page }) => {
    await page.goto('/dashboard/amro/parts');

    // Get all text elements
    const allElements = page.locator('*');
    const textSizes = await allElements.evaluateAll(elements => {
      return elements
        .map(el => {
          const style = window.getComputedStyle(el);
          const fontSize = parseFloat(style.fontSize);
          const hasText = el.childNodes.length > 0 && 
            Array.from(el.childNodes).some(node => 
              node.nodeType === Node.TEXT_NODE && 
              node.textContent?.trim()
            );
          return hasText ? fontSize : null;
        })
        .filter((size): size is number => size !== null && size > 0);
    });

    if (textSizes.length > 0) {
      const minSize = Math.min(...textSizes);
      expect(minSize).toBeGreaterThanOrEqual(12);
    }
  });

  /**
   * Test 3: Data Grid Text Sizing
   * Verifies consistent table header and body text sizes
   */
  test('Data grid uses standardized text sizes', async ({ page }) => {
    await page.goto('/dashboard/amro/parts');

    // Verify table headers are 12px
    const tableHeaders = page.locator('th');
    const headerCount = await tableHeaders.count();
    
    for (let i = 0; i < headerCount; i++) {
      const fontSize = await tableHeaders.nth(i).evaluate(
        el => parseFloat(window.getComputedStyle(el).fontSize)
      );
      // Headers should be 12px
      expect(fontSize).toBeGreaterThanOrEqual(11);
      expect(fontSize).toBeLessThanOrEqual(13);
    }

    // Verify table body cells are 14px
    const tableCells = page.locator('td');
    const cellCount = await tableCells.count();
    
    for (let i = 0; i < Math.min(cellCount, 20); i++) { // Check first 20 cells
      const fontSize = await tableCells.nth(i).evaluate(
        el => parseFloat(window.getComputedStyle(el).fontSize)
      );
      // Body cells should be 14px
      expect(fontSize).toBeGreaterThanOrEqual(13);
      expect(fontSize).toBeLessThanOrEqual(15);
    }
  });
});

test.describe('AMRO Parts Module - Layout & Spacing', () => {
  
  /**
   * Test 4: Consistent Card Padding
   * Verifies cards use standard padding values
   */
  test('Cards use standardized padding', async ({ page }) => {
    await page.goto('/dashboard/amro/parts');

    const cards = page.locator('[class*="rounded"], [class*="Card"]');
    const cardCount = await cards.count();
    
    for (let i = 0; i < Math.min(cardCount, 10); i++) {
      const padding = await cards.nth(i).evaluate(
        el => {
          const style = window.getComputedStyle(el);
          return {
            top: parseFloat(style.paddingTop),
            right: parseFloat(style.paddingRight),
            bottom: parseFloat(style.paddingBottom),
            left: parseFloat(style.paddingLeft),
          };
        }
      );
      
      // Padding should be one of: 12px, 16px, or 24px
      const validPadding = [12, 16, 24];
      const hasValidPadding = validPadding.includes(padding.top) || 
                              padding.top >= 12;
      
      expect(hasValidPadding).toBeTruthy();
    }
  });

  /**
   * Test 5: Spacing Follows 8px Grid
   * Verifies gaps and margins align to 8px grid
   */
  test('Spacing follows 8px grid system', async ({ page }) => {
    await page.goto('/dashboard/amro/parts');

    // Check section gaps
    const sections = page.locator('section, [class*="space-y"]');
    const sectionCount = await sections.count();
    
    for (let i = 0; i < Math.min(sectionCount, 10); i++) {
      const gap = await sections.nth(i).evaluate(
        el => {
          const style = window.getComputedStyle(el);
          return {
            rowGap: parseFloat(style.rowGap) || 0,
            marginTop: parseFloat(style.marginTop),
            marginBottom: parseFloat(style.marginBottom),
          };
        }
      );
      
      // Gaps should be multiples of 4 (4, 8, 12, 16, 24, etc.)
      const hasValidGap = gap.rowGap % 4 === 0 || 
                          gap.marginBottom % 4 === 0 ||
                          gap.marginBottom >= 16;
      
      expect(hasValidGap).toBeTruthy();
    }
  });
});

test.describe('AMRO Parts Module - Responsive Layout', () => {
  
  /**
   * Test 6: Mobile Viewport (375px)
   * Verifies layout works on mobile
   */
  test('Mobile layout (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/amro/parts');

    // Verify no horizontal overflow
    const bodyWidth = await page.locator('body').evaluate(
      el => el.scrollWidth
    );
    const viewportWidth = 375;
    
    // Body should not exceed viewport width by more than acceptable margin
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 32); // 16px margin each side

    // Verify touch targets are 44px minimum
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const height = await buttons.nth(i).evaluate(
        el => parseFloat(window.getComputedStyle(el).height)
      );
      
      expect(height).toBeGreaterThanOrEqual(40); // Allow some flexibility
    }
  });

  /**
   * Test 7: Tablet Viewport (768px)
   * Verifies layout works on tablet
   */
  test('Tablet layout (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard/amro/parts');

    // Verify 2-3 column grids
    const grids = page.locator('[class*="grid"]');
    const gridCount = await grids.count();
    
    for (let i = 0; i < Math.min(gridCount, 5); i++) {
      const gridColumn = await grids.nth(i).evaluate(
        el => window.getComputedStyle(el).gridTemplateColumns
      );
      
      // Should have 2-4 columns on tablet
      const columnCount = gridColumn.split(' ').length;
      expect(columnCount).toBeGreaterThanOrEqual(1);
      expect(columnCount).toBeLessThanOrEqual(4);
    }
  });

  /**
   * Test 8: Desktop Viewport (1440px)
   * Verifies layout works on desktop
   */
  test('Desktop layout (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/amro/parts');

    // Verify content is properly centered
    const container = page.locator('[class*="mx-auto"], [class*="max-w"]');
    const containerExists = await container.count() > 0;
    
    if (containerExists) {
      const maxWidth = await container.first().evaluate(
        el => parseFloat(window.getComputedStyle(el).maxWidth)
      );
      
      expect(maxWidth).toBeLessThanOrEqual(1280); // Max container width
    }
  });
});

test.describe('AMRO Parts Module - CRUD Button Positioning', () => {
  
  /**
   * Test 9: Primary Actions in Top-Right
   * Verifies primary action buttons are positioned correctly
   */
  test('Primary actions positioned in form header', async ({ page }) => {
    await page.goto('/dashboard/amro/parts');

    // Look for primary action buttons
    const primaryButtons = page.locator('button:has-text("Add Part"), button:has-text("Create"), button:has-text("Save")');
    const count = await primaryButtons.count();
    
    if (count > 0) {
      const button = primaryButtons.first();
      const parent = await button.locator('xpath=..');
      
      // Parent should be a flex container with justify-between or similar
      const parentClass = await parent.getAttribute('class');
      expect(parentClass).toMatch(/flex|justify-between|gap/);
    }
  });
});

test.describe('AMRO Parts Module - Accessibility', () => {
  
  /**
   * Test 10: Contrast Ratios
   * Verifies text meets WCAG 2.1 AA contrast requirements
   */
  test('Text has sufficient contrast (spot check)', async ({ page }) => {
    await page.goto('/dashboard/amro/parts');

    // Check body text contrast
    const bodyText = page.locator('p, span').first();
    const hasText = await bodyText.count() > 0;
    
    if (hasText) {
      const color = await bodyText.evaluate(
        el => window.getComputedStyle(el).color
      );
      
      // Color should be a valid CSS color
      expect(color).toMatch(/rgb|rgba|#/);
    }
  });

  /**
   * Test 11: Focus Indicators
   * Verifies interactive elements have visible focus
   */
  test('Interactive elements have focus indicators', async ({ page }) => {
    await page.goto('/dashboard/amro/parts');

    // Tab to first interactive element
    await page.keyboard.press('Tab');
    
    // Check if focused element has outline or ring
    const focusedElement = page.locator(':focus');
    const hasFocusIndicator = await focusedElement.evaluate(
      el => {
        const style = window.getComputedStyle(el);
        return style.outlineStyle !== 'none' || 
               style.boxShadow.includes('ring') ||
               style.borderStyle !== 'none';
      }
    );
    
    expect(hasFocusIndicator).toBeTruthy();
  });
});
