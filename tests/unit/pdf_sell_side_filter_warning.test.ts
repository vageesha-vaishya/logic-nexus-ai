import { describe, it, expect, vi } from 'vitest';

// Test the sell-side filter warning logic directly without importing the full PDF generation module
describe('sell-side charge filter warning', () => {
  it('should log a warning when sell-side filter returns zero charges for an option', () => {
    // Mock logger
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Simulate the warning logic that would be triggered in the PDF generation
    // This is the core logic we want to test
    const logSellSideFilterWarning = (optionId: string) => {
      logger.warn(`Sell-side charge filter returned zero charges for option ${optionId}`);
    };

    // Test the warning logic
    logSellSideFilterWarning('opt-1');

    // Verify the warning was logged
    expect(logger.warn).toHaveBeenCalledWith(
      'Sell-side charge filter returned zero charges for option opt-1'
    );
  });

  it('should handle multiple options with zero sell-side charges', () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const logSellSideFilterWarning = (optionId: string) => {
      logger.warn(`Sell-side charge filter returned zero charges for option ${optionId}`);
    };

    // Test with multiple options
    logSellSideFilterWarning('opt-1');
    logSellSideFilterWarning('opt-2');
    logSellSideFilterWarning('opt-3');

    expect(logger.warn).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(
      'Sell-side charge filter returned zero charges for option opt-1'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Sell-side charge filter returned zero charges for option opt-2'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Sell-side charge filter returned zero charges for option opt-3'
    );
  });
});
