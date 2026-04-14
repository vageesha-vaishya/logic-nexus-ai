/**
 * Unit Tests for TemplateCard Component (Mobile View)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateCard } from '../components/TemplateCard';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CheckCircle2: () => <span data-testid="check-icon" />,
  CircleDot: () => <span data-testid="circle-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
  Copy: () => <span data-testid="copy-icon" />,
  Eye: () => <span data-testid="eye-icon" />,
  FileEdit: () => <span data-testid="edit-icon" />,
  History: () => <span data-testid="history-icon" />,
  MoreHorizontal: () => <span data-testid="more-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
}));

// Mock shadcn components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ ...props }: any) => <input type="checkbox" {...props} />,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  DropdownMenuSeparator: () => <hr />,
}));

describe('TemplateCard', () => {
  const mockTemplate = {
    id: 'template-1',
    tenant_id: 'tenant-1',
    franchise_id: null,
    template_code: 'TPL-001',
    template_name: 'A320 Line Maintenance',
    description: 'Regular line maintenance check for A320 aircraft',
    maintenance_type: 'line',
    model_id: 'model-1',
    aircraft_model: 'A320',
    version: 3,
    active: true,
    status: 'active',
    scope_json: {},
    tasks_json: [],
    materials_json: [],
    tooling_json: [],
    compliance_requirements_json: [],
    policy_snapshot_id: null,
    tasks_count: 24,
    estimated_labor_hours: 12,
    created_at: '2026-04-10T10:00:00Z',
    updated_at: '2026-04-14T08:00:00Z',
    created_by: 'user-1',
    updated_by: 'user-2',
  };

  const defaultProps = {
    template: mockTemplate,
    isSelected: false,
    onToggleSelect: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onClone: vi.fn(),
    onPreview: vi.fn(),
    onManageVersions: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render template name and code', () => {
      render(<TemplateCard {...defaultProps} />);
      
      expect(screen.getByText('A320 Line Maintenance')).toBeInTheDocument();
      expect(screen.getByText('TPL-001')).toBeInTheDocument();
    });

    it('should render status badge', () => {
      render(<TemplateCard {...defaultProps} />);
      
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should render maintenance type badge', () => {
      render(<TemplateCard {...defaultProps} />);
      
      expect(screen.getByText('Line')).toBeInTheDocument();
    });

    it('should render version badge', () => {
      render(<TemplateCard {...defaultProps} />);
      
      expect(screen.getByText('v3')).toBeInTheDocument();
    });

    it('should render aircraft model', () => {
      render(<TemplateCard {...defaultProps} />);
      
      expect(screen.getByText('A320')).toBeInTheDocument();
    });

    it('should render tasks count', () => {
      render(<TemplateCard {...defaultProps} />);
      
      expect(screen.getByText('24')).toBeInTheDocument();
    });

    it('should render estimated labor hours', () => {
      render(<TemplateCard {...defaultProps} />);
      
      expect(screen.getByText('12h')).toBeInTheDocument();
    });

    it('should render description', () => {
      render(<TemplateCard {...defaultProps} />);
      
      expect(screen.getByText('Regular line maintenance check for A320 aircraft')).toBeInTheDocument();
    });

    it('should not render version badge for version 1', () => {
      const templateV1 = { ...mockTemplate, version: 1 };
      render(<TemplateCard {...defaultProps} template={templateV1} />);
      
      expect(screen.queryByText('v1')).not.toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('should call onToggleSelect when checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(<TemplateCard {...defaultProps} />);
      
      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);
      
      expect(defaultProps.onToggleSelect).toHaveBeenCalledWith('template-1');
    });

    it('should highlight card when selected', () => {
      render(<TemplateCard {...defaultProps} isSelected />);
      
      const card = screen.getByRole('article');
      expect(card).toHaveClass('border-primary');
    });
  });

  describe('Actions', () => {
    it('should call onPreview when card is tapped', async () => {
      const user = userEvent.setup();
      render(<TemplateCard {...defaultProps} />);
      
      const button = screen.getByRole('button', { name: /view/i });
      await user.click(button);
      
      expect(defaultProps.onPreview).toHaveBeenCalledWith(mockTemplate);
    });

    it('should render actions dropdown trigger', () => {
      render(<TemplateCard {...defaultProps} />);
      
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have ARIA label', () => {
      render(<TemplateCard {...defaultProps} />);
      
      expect(screen.getByRole('article')).toHaveAttribute(
        'aria-label',
        'Template: A320 Line Maintenance'
      );
    });

    it('should have checkbox ARIA label', () => {
      render(<TemplateCard {...defaultProps} />);
      
      expect(screen.getByRole('checkbox')).toHaveAttribute(
        'aria-label',
        'Select A320 Line Maintenance'
      );
    });
  });

  describe('Different Statuses', () => {
    it('should render draft status correctly', () => {
      const draftTemplate = { ...mockTemplate, status: 'draft' };
      render(<TemplateCard {...defaultProps} template={draftTemplate} />);
      
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('should render pending_review status correctly', () => {
      const pendingTemplate = { ...mockTemplate, status: 'pending_review' };
      render(<TemplateCard {...defaultProps} template={pendingTemplate} />);
      
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should render deprecated status correctly', () => {
      const deprecatedTemplate = { ...mockTemplate, status: 'deprecated' };
      render(<TemplateCard {...defaultProps} template={deprecatedTemplate} />);
      
      expect(screen.getByText('Deprecated')).toBeInTheDocument();
    });
  });

  describe('Relative Time Formatting', () => {
    it('should show relative time', () => {
      render(<TemplateCard {...defaultProps} />);
      
      // Should show relative time format (e.g., "6h ago" or similar)
      expect(screen.getByText(/Updated/i)).toBeInTheDocument();
    });
  });
});
