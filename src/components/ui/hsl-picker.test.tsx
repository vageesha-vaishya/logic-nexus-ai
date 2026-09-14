import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HslPicker } from './hsl-picker';

describe('HslPicker', () => {
  it('associates every input with its label', () => {
    render(<HslPicker label="Primary" value="217 91% 53%" onChange={vi.fn()} />);
    for (const name of ['Pick', 'Hue', 'Sat', 'Light']) {
      expect(screen.getAllByLabelText(new RegExp(name)).length).toBeGreaterThan(0);
    }
  });
});
