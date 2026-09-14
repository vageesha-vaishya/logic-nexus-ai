import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

describe('Badge tone', () => {
  it('renders tone surface/foreground/border classes', () => {
    render(<Badge tone="success">Won</Badge>);
    const el = screen.getByText('Won');
    expect(el.className).toContain('bg-status-success');
    expect(el.className).toContain('text-status-success-foreground');
    expect(el.className).toContain('border-status-success-border');
  });

  it('keeps the action variants when no tone is given', () => {
    render(<Badge variant="destructive">Delete</Badge>);
    expect(screen.getByText('Delete').className).toContain('bg-destructive');
  });

  it('tone wins over variant surface when both are given', () => {
    render(<Badge variant="outline" tone="warning">Pending</Badge>);
    const el = screen.getByText('Pending');
    expect(el.className).toContain('bg-status-warning');
    expect(el.className).not.toContain('bg-primary');
  });
});
