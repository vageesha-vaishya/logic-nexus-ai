// Phase 7 UIM Step 8.2 — CatalogItem type.
//
// Backed by uim_catalog_items, with MRO profile attributes hoisted
// from the JSONB `attributes` column as first-class fields (the
// frontend already keys off them; making them typed avoids a string
// trip in every resolver).

import { builder } from '../builder.js';

export type CatalogItemRow = {
  id: string;
  sku: string;
  part_number: string | null;
  title: string | null;
  category: string | null;
  unit_of_measure: string | null;
  is_serialized: boolean;
  attributes: Record<string, unknown> | null;
};

export const CatalogItemRef = builder.objectRef<CatalogItemRow>('CatalogItem');

function attr(row: CatalogItemRow, key: string): unknown {
  return (row.attributes ?? {})[key];
}

builder.objectType(CatalogItemRef, {
  description:
    'A catalog item — the SKU-level definition. Inventory items reference catalog items.',
  fields: (t) => ({
    id: t.exposeID('id'),
    sku: t.exposeString('sku'),
    partNumber: t.string({
      nullable: true,
      resolve: (parent) => parent.part_number,
    }),
    title: t.string({
      nullable: true,
      resolve: (parent) => parent.title,
    }),
    category: t.string({
      nullable: true,
      resolve: (parent) => parent.category,
    }),
    unitOfMeasure: t.string({
      nullable: true,
      resolve: (parent) => parent.unit_of_measure,
    }),
    isSerialized: t.boolean({
      resolve: (parent) => Boolean(parent.is_serialized),
    }),
    attributes: t.field({
      type: 'JSON',
      nullable: true,
      resolve: (parent) => parent.attributes,
    }),
    // MRO profile fields lifted from attributes JSONB.
    maintenanceCategory: t.string({
      nullable: true,
      resolve: (parent) => {
        const value = attr(parent, 'maintenance_category');
        return value ? String(value) : null;
      },
    }),
    ataChapterCode: t.string({
      nullable: true,
      resolve: (parent) => {
        const value = attr(parent, 'ata_chapter_code');
        return value ? String(value) : null;
      },
    }),
    conditionCode: t.string({
      nullable: true,
      resolve: (parent) => {
        const value = attr(parent, 'condition_code');
        return value ? String(value) : null;
      },
    }),
    certificationStatus: t.string({
      nullable: true,
      resolve: (parent) => {
        const value = attr(parent, 'certification_status');
        return value ? String(value) : null;
      },
    }),
    aogPriority: t.boolean({
      resolve: (parent) => Boolean(attr(parent, 'aog_priority')),
    }),
  }),
});
