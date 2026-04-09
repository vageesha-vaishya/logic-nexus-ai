import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AmroHeaderCell,
  AmroTableMessageRow,
  amroCompactTableClassNames,
  amroTableClassNames,
} from './amroTableStandards';

const meta: Meta = {
  title: 'AMRO/Parts/Table Standards',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          'Single benchmark story for default vs compact density, sticky headers, and empty/loading treatment.',
          '',
          'Chromatic / Visual Regression Release Checklist (Pass/Fail):',
          '- [ ] Default density row height remains visually unchanged from baseline.',
          '- [ ] Compact density row height remains visually unchanged from baseline.',
          '- [ ] Header-cell alignment and column text baselines match baseline snapshots.',
          '- [ ] Sticky header remains pinned during scroll in both default and compact variants.',
          '- [ ] Loading state message row spacing and border treatment match baseline.',
          '- [ ] Empty state message row spacing and border treatment match baseline.',
          '- [ ] Badge/cell vertical centering is unchanged after table updates.',
          '- [ ] No unexpected horizontal overflow or clipped text at standard breakpoints.',
        ].join('\n'),
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const defaultRows = Array.from({ length: 16 }).map((_, index) => ({
  id: `R-${index + 1}`,
  part: `AMRO-${String(1000 + index)}`,
  type: index % 2 === 0 ? 'part' : 'consumable',
  balance: (32 - index) * 2.5,
  status: index % 5 === 0 ? 'low_stock' : 'available',
}));

const compactRows = Array.from({ length: 12 }).map((_, index) => ({
  id: `A-${index + 1}`,
  requestType: index % 2 ? 'period_reopen' : 'adjustment',
  status: index % 3 ? 'pending' : 'approved',
  period: `2026-${String((index % 12) + 1).padStart(2, '0')}`,
}));

export const DensityAndStickyHeaders: Story = {
  render: () => (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Default Density Table (Sticky Header + Scroll)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`${amroTableClassNames.container} max-h-[260px]`}>
            <table className={amroTableClassNames.table}>
              <thead className={amroTableClassNames.thead}>
                <tr>
                  <AmroHeaderCell>Part Number</AmroHeaderCell>
                  <AmroHeaderCell>Type</AmroHeaderCell>
                  <AmroHeaderCell>Balance</AmroHeaderCell>
                  <AmroHeaderCell>Status</AmroHeaderCell>
                </tr>
              </thead>
              <tbody>
                {defaultRows.map((row) => (
                  <tr key={row.id} className={amroTableClassNames.row}>
                    <td className={amroTableClassNames.td}>{row.part}</td>
                    <td className={amroTableClassNames.td}>{row.type}</td>
                    <td className={amroTableClassNames.td}>{row.balance.toFixed(2)}</td>
                    <td className={amroTableClassNames.td}>
                      <Badge variant={row.status === 'low_stock' ? 'destructive' : 'outline'}>{row.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Compact Density Table (Sticky Header + Scroll)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`${amroTableClassNames.container} max-h-[220px]`}>
            <table className={amroCompactTableClassNames.table}>
              <thead className={amroCompactTableClassNames.thead}>
                <tr>
                  <AmroHeaderCell compact>Request Type</AmroHeaderCell>
                  <AmroHeaderCell compact>Status</AmroHeaderCell>
                  <AmroHeaderCell compact>Period</AmroHeaderCell>
                </tr>
              </thead>
              <tbody>
                {compactRows.map((row) => (
                  <tr key={row.id} className={amroCompactTableClassNames.row}>
                    <td className={amroCompactTableClassNames.td}>{row.requestType}</td>
                    <td className={amroCompactTableClassNames.td}>
                      <Badge variant={row.status === 'pending' ? 'outline' : 'default'}>{row.status}</Badge>
                    </td>
                    <td className={amroCompactTableClassNames.td}>{row.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  ),
};

export const LoadingAndEmptyStates: Story = {
  render: () => (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Loading State</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={amroTableClassNames.container}>
            <table className={amroTableClassNames.table}>
              <thead className={amroTableClassNames.thead}>
                <tr>
                  <AmroHeaderCell>Column A</AmroHeaderCell>
                  <AmroHeaderCell>Column B</AmroHeaderCell>
                </tr>
              </thead>
              <tbody>
                <AmroTableMessageRow colSpan={2}>Loading records...</AmroTableMessageRow>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Empty State</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={amroTableClassNames.container}>
            <table className={amroTableClassNames.table}>
              <thead className={amroTableClassNames.thead}>
                <tr>
                  <AmroHeaderCell>Column A</AmroHeaderCell>
                  <AmroHeaderCell>Column B</AmroHeaderCell>
                </tr>
              </thead>
              <tbody>
                <AmroTableMessageRow colSpan={2}>No records found.</AmroTableMessageRow>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  ),
};
