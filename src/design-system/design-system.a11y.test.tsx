import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CRMButton } from './components';

expect.extend(toHaveNoViolations);

describe('design system accessibility', () => {
  it('has zero axe violations for button variants', async () => {
    const { container } = render(
      <div>
        <CRMButton variant="primary">Primary</CRMButton>
        <CRMButton variant="secondary">Secondary</CRMButton>
        <CRMButton variant="danger">Danger</CRMButton>
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
