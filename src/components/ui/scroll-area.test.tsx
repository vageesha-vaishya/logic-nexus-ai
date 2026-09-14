import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScrollArea } from './scroll-area';

describe('ScrollArea', () => {
  it('viewport is focusable so keyboard users can scroll it', () => {
    render(
      <ScrollArea>
        <div style={{ height: 2000 }}>tall</div>
      </ScrollArea>
    );

    expect(document.querySelector('[data-radix-scroll-area-viewport]')).toHaveAttribute('tabindex', '0');
  });
});
