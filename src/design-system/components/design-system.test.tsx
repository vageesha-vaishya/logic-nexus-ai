import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import {
  CRMBadge,
  CRMButton,
  CRMContactListPage,
  CRMCRUDLayout,
  CRMDataTable,
  CRMDatePicker,
  CRMDealPipelinePage,
  CRMFilterBar,
  CRMFormField,
  CRMIcon,
  CRMLink,
  CRMModal,
  CRMNavigation,
  CRMPageShell,
  CRMSearchBar,
  CRMToast
} from './index';

expect.extend(toHaveNoViolations);

describe('design system components', () => {
  it('renders atom variants and supports keyboard interactions', async () => {
    const onClick = jest.fn();
    render(
      <div>
        <CRMButton variant="primary" onClick={onClick}>Save</CRMButton>
        <CRMButton variant="secondary">Secondary</CRMButton>
        <CRMButton variant="danger">Delete</CRMButton>
        <CRMIcon name="danger" aria-label="Danger icon" />
        <CRMLink href="#x">Go</CRMLink>
        <CRMBadge variant="secondary">Active</CRMBadge>
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('link', { name: 'Go' }), { key: ' ' });
    expect(screen.getByText('Active')).toBeVisible();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('renders molecules and handles interactions', async () => {
    const onSearch = jest.fn();
    const onClose = jest.fn();
    render(
      <div>
        <CRMFormField id="name" label="Name" helperText="Provide full name" inputProps={{ defaultValue: 'Alex' }} />
        <CRMSearchBar value="ABC" onSearch={onSearch} />
        <CRMDatePicker />
        <CRMToast title="Saved" message="Updated" onClose={onClose} />
      </div>
    );
    fireEvent.keyDown(screen.getByLabelText('Search'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onSearch).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('renders organisms', async () => {
    render(
      <div>
        <CRMNavigation items={[{ id: 'a', label: 'A', href: '#a', badge: '1' }]} activeId="a" />
        <CRMFilterBar filters={[{ label: 'Status', value: 'Active' }]} />
        <CRMDataTable
          columns={[{ key: 'name', label: 'Name' }]}
          rows={[{ name: 'Record 1' }]}
        />
      </div>
    );
    expect(screen.getByRole('navigation', { name: 'CRM navigation' })).toBeVisible();
    expect(screen.getByRole('table', { name: 'CRM data table' })).toBeVisible();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('renders modal and template/page composites', async () => {
    const onOpenChange = jest.fn();
    const onConfirm = jest.fn();
    render(
      <div>
        <CRMModal open title="Confirm" onOpenChange={onOpenChange} onConfirm={onConfirm}>
          Confirm text
        </CRMModal>
        <CRMPageShell title="CRM" navigationItems={[{ id: 'home', label: 'Home', href: '#home' }]} activeNavId="home">
          <CRMCRUDLayout
            title="Records"
            table={<CRMDataTable columns={[{ key: 'id', label: 'ID' }]} rows={[{ id: '1' }]} />}
          />
        </CRMPageShell>
        <CRMContactListPage />
        <CRMDealPipelinePage />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Contact Registry' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Deal Pipeline' })).toBeVisible();
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
