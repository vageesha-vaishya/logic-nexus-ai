import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WidgetContainer } from '../WidgetContainer';

describe('WidgetContainer Component', () => {
  it('renders widget with title and children', () => {
    render(
      <WidgetContainer title="Test Widget">
        <div>Test content</div>
      </WidgetContainer>
    );

    expect(screen.getByText('Test Widget')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders without title when not provided', () => {
    render(
      <WidgetContainer>
        <div>Test content</div>
      </WidgetContainer>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders with action node when provided', () => {
    render(
      <WidgetContainer title="Test Widget" action={<button>Action</button>}>
        <div>Test content</div>
      </WidgetContainer>
    );

    expect(screen.getByText('Test Widget')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('applies custom className to container', () => {
    const { container } = render(
      <WidgetContainer title="Test" className="custom-class">
        <div>Test content</div>
      </WidgetContainer>
    );

    const card = container.querySelector('.custom-class');
    expect(card).toBeInTheDocument();
  });

  it('applies custom contentClassName to content area', () => {
    const { container } = render(
      <WidgetContainer contentClassName="custom-content" title="Test">
        <div>Test content</div>
      </WidgetContainer>
    );

    const content = container.querySelector('.custom-content');
    expect(content).toBeInTheDocument();
  });

  it('renders complex children correctly', () => {
    render(
      <WidgetContainer title="Complex Widget">
        <div className="test-class">
          <p>Paragraph 1</p>
          <p>Paragraph 2</p>
        </div>
      </WidgetContainer>
    );

    expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
    expect(screen.getByText('Paragraph 2')).toBeInTheDocument();
  });
});
