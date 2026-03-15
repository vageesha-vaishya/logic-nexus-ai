import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ObjectMenu } from './ObjectMenu';

describe('ObjectMenu', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('opens app launcher content on click', () => {
    render(
      <MemoryRouter>
        <ObjectMenu />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /app launcher/i }));

    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard overview and key metrics/i })).toBeInTheDocument();
  });

  it('closes app launcher after selecting a destination', () => {
    render(
      <MemoryRouter>
        <ObjectMenu />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /app launcher/i }));
    fireEvent.click(screen.getByRole('link', { name: /dashboard overview and key metrics/i }));

    expect(screen.queryByText('Sales')).not.toBeInTheDocument();
  });

  it('supports hover open and hover leave close behavior', () => {
    render(
      <MemoryRouter>
        <ObjectMenu />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: /app launcher/i });
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(90);
    });
    expect(screen.getByText('Sales')).toBeInTheDocument();

    fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(130);
    });
    expect(screen.queryByText('Sales')).not.toBeInTheDocument();
  });

  it('supports keyboard activation for accessibility', () => {
    render(
      <MemoryRouter>
        <ObjectMenu />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: /app launcher/i });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(screen.getByText('Sales')).toBeInTheDocument();
  });

  it('opens on touch pointer down to support mobile interaction', () => {
    render(
      <MemoryRouter>
        <ObjectMenu />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: /app launcher/i });
    fireEvent.pointerDown(trigger, { pointerType: 'touch' });

    expect(screen.getByText('Sales')).toBeInTheDocument();
  });

  it('remains stable during rapid hover transitions', () => {
    render(
      <MemoryRouter>
        <ObjectMenu />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: /app launcher/i });
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(90);
    });
    expect(screen.getByText('Sales')).toBeInTheDocument();
  });

  it('handles rapid clicking without losing menu control', () => {
    render(
      <MemoryRouter>
        <ObjectMenu />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: /app launcher/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    fireEvent.click(trigger);

    expect(screen.getByText('Sales')).toBeInTheDocument();
  });

  it('renders complete launcher options with scrollable content container', () => {
    render(
      <MemoryRouter>
        <ObjectMenu />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /app launcher/i }));

    expect(screen.getByRole('link', { name: /themes customize look and feel/i })).toBeInTheDocument();
    expect(screen.getByTestId('app-launcher-content').className).toContain('overflow-y-auto');
    expect(screen.getByTestId('app-launcher-content').className).toContain('max-h-[min(78vh,720px)]');
  });
});
