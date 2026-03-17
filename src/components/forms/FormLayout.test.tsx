import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormGrid, FormItem, FormSection } from './FormLayout';

describe('FormLayout', () => {
  it('renders complex entity layout blocks independently', () => {
    render(
      <FormSection title="Complex Entity Form" description="layout test">
        <FormGrid columns={4} data-testid="grid">
          <FormItem span={2}>
            <div>Field A</div>
          </FormItem>
          <FormItem span={2}>
            <div>Field B</div>
          </FormItem>
          <FormItem span="full">
            <div>Field C</div>
          </FormItem>
        </FormGrid>
      </FormSection>,
    );

    expect(screen.getByText('Complex Entity Form')).toBeInTheDocument();
    expect(screen.getByText('Field A')).toBeInTheDocument();
    expect(screen.getByText('Field B')).toBeInTheDocument();
    expect(screen.getByText('Field C')).toBeInTheDocument();
    expect(screen.getByTestId('grid').className).toContain('lg:grid-cols-4');
  });
});
