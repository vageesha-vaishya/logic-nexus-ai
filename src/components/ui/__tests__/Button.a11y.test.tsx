import { render } from '@testing-library/react';
import { Button } from '../button';
import { axe, toHaveNoViolations } from 'jest-axe';
import { expect, test } from 'vitest';
import { Bell } from 'lucide-react';

expect.extend(toHaveNoViolations);

test('Button should have no accessibility violations', async () => {
  const { container } = render(<Button>Click me</Button>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

test('Icon-only Button should have no accessibility violations when aria-label is provided', async () => {
  const { container } = render(
    <Button size="icon" aria-label="Notifications">
      <Bell />
    </Button>
  );
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

test('Icon-only Button should fail accessibility check when aria-label is missing', async () => {
  const { container } = render(
    <Button size="icon">
      <Bell />
    </Button>
  );
  const results = await axe(container);
  // This is expected to have violations because it's an icon-only button without a label
  expect(results.violations.length).toBeGreaterThan(0);
});
