import {
  AmroInventoryDataGridTemplate,
  type AmroInventoryDataGridTemplateProps,
  type GridDensity,
  type GridScrollBehavior,
  type GridViewMode,
} from '../templates/AmroInventoryDataGridTemplate';

type Props<TRecord extends Record<string, unknown>> = Omit<AmroInventoryDataGridTemplateProps<TRecord>, 'viewMode' | 'density' | 'scrollBehavior' | 'pageSize'> & {
  viewMode?: GridViewMode;
  density?: GridDensity;
  scrollBehavior?: GridScrollBehavior;
  pageSize?: number;
};

export function AmroUnifiedGridRecordDetailShell<TRecord extends Record<string, unknown>>({
  viewMode = 'stacked-auto',
  density = 'normal',
  scrollBehavior = 'virtualization',
  pageSize = 25,
  ariaLabel = 'AMRO unified grid-record-detail',
  ...props
}: Props<TRecord>): JSX.Element {
  return (
    <AmroInventoryDataGridTemplate
      viewMode={viewMode}
      density={density}
      scrollBehavior={scrollBehavior}
      pageSize={pageSize}
      ariaLabel={ariaLabel}
      {...props}
    />
  );
}
