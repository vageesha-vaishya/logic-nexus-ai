import type { Meta, StoryObj } from '@storybook/react';
import { DocumentRepository, Document } from '../../components/crm/DocumentRepository';
import { mockDocuments, mockUsers } from './mock-data';
import { SkeletonCards } from '@/components/ui/skeleton-table';
import { EmptyState, emptyStates } from '@/components/ui/empty-state';

const meta: Meta<typeof DocumentRepository> = {
  title: 'CRM/DocumentRepository',
  component: DocumentRepository,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A file management component supporting grid/list views, searching, and filtering. Ideal for managing lead-specific documents like contracts and proposals.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onUpload: { action: 'upload' },
    onDownload: { action: 'download' },
    onDelete: { action: 'delete' },
  },
};

export default meta;
type Story = StoryObj<typeof DocumentRepository>;

const enhancedMockDocs: Document[] = mockDocuments.map(d => ({
  ...d,
  uploaded_by: mockUsers[0],
  url: '#',
  tags: d.type === 'pdf' ? ['Contract', 'Important'] : ['Reference']
}));

export const Default: Story = {
  args: {
    documents: enhancedMockDocs,
    className: 'h-[600px]',
  },
};

export const Empty: Story = {
  args: {
    documents: [],
    className: 'h-[600px]',
  },
};

export const Loading: Story = {
  render: () => (
    <div className="h-[600px] p-6">
      <SkeletonCards count={6} />
    </div>
  ),
};

export const Error: Story = {
  render: () => (
    <div className="h-[600px] p-6">
      <EmptyState {...emptyStates.error('Failed to load documents')} />
    </div>
  ),
};

export const RTL: Story = {
  render: () => (
    <div dir="rtl" className="h-[600px] p-6">
      <DocumentRepository documents={enhancedMockDocs} />
    </div>
  ),
  parameters: {
    test: { disable: true }
  }
};
