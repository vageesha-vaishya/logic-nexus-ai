import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeadsFilterToolbar } from './LeadsFilterToolbar';

function renderToolbar() {
  render(
    <LeadsFilterToolbar
      localSearch=""
      onLocalSearchChange={vi.fn()}
      hasActiveSearch={false}
      matchedLeadIds={[]}
      activeMatchedLeadId={null}
      onNavigateMatchedLeads={vi.fn()}
      statusFilter="all"
      onStatusFilterChange={vi.fn()}
      ownerFilter="any"
      onOwnerFilterChange={vi.fn()}
      scoreFilter="all"
      onScoreFilterChange={vi.fn()}
      groupBy="none"
      onGroupByChange={vi.fn()}
      valueMin=""
      onValueMinChange={vi.fn()}
      valueMax=""
      onValueMaxChange={vi.fn()}
      nameOp="contains"
      onNameOpChange={vi.fn()}
      nameQuery=""
      onNameQueryChange={vi.fn()}
      visibleFieldSet={new Set()}
      onFieldVisibilityChange={vi.fn()}
      activeFilterTags={[]}
      onClearAllFilters={vi.fn()}
    />
  );
}

describe('LeadsFilterToolbar', () => {
  it('gives every filter select an accessible name', () => {
    renderToolbar();
    const boxes = screen.getAllByRole('combobox');
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) expect(box).toHaveAccessibleName();
  });
});
