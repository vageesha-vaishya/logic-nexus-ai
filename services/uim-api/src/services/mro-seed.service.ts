export type UimMroSeedItem = {
  sku: string;
  part_number: string;
  serial_number: string;
  title: string;
  category: 'rotable' | 'consumable' | 'tooling' | 'equipment';
  manufacturer_name: string;
  manufacturer_code: string;
  ata_chapter_code: string;
  ata_sub_chapter_code: string;
  ata_section_code: string;
  maintenance_category: 'rotable' | 'consumable' | 'tooling' | 'equipment' | 'emergency-spare';
  shelf_life_days: number | null;
  condition_code: 'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR';
  storage_requirements: Record<string, unknown>;
  certification_status: 'valid' | 'expiring' | 'expired' | 'pending';
  hazardous_material: boolean;
  aog_priority: boolean;
  quantity: number;
};

const MIN_SEED_COUNT = 500;
const MAX_SEED_COUNT = 1000;
const DEFAULT_SEED_COUNT = 800;

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

function categoryFor(index: number): UimMroSeedItem['category'] {
  const categories: UimMroSeedItem['category'][] = ['rotable', 'consumable', 'tooling', 'equipment'];
  return categories[index % categories.length] || 'rotable';
}

function maintenanceCategoryFor(index: number, category: UimMroSeedItem['category']): UimMroSeedItem['maintenance_category'] {
  if (index % 12 === 0) return 'emergency-spare';
  return category;
}

function conditionCodeFor(index: number): UimMroSeedItem['condition_code'] {
  if (index % 45 === 0) return 'QUAR';
  if (index % 30 === 0) return 'INSP';
  if (index % 60 === 0) return 'OH';
  return 'SV';
}

function certificationStatusFor(index: number): UimMroSeedItem['certification_status'] {
  if (index % 35 === 0) return 'expired';
  if (index % 20 === 0) return 'expiring';
  if (index % 17 === 0) return 'pending';
  return 'valid';
}

export function normalizeSeedCount(inputCount?: number): number {
  const parsed = Number(inputCount);
  if (!Number.isFinite(parsed)) return DEFAULT_SEED_COUNT;
  const rounded = Math.floor(parsed);
  if (rounded < MIN_SEED_COUNT) return MIN_SEED_COUNT;
  if (rounded > MAX_SEED_COUNT) return MAX_SEED_COUNT;
  return rounded;
}

export function buildUimMroSeedItems(inputCount?: number): UimMroSeedItem[] {
  const count = normalizeSeedCount(inputCount);
  const manufacturers = ['CFM', 'Honeywell', 'Collins', 'Safran', 'Parker', 'Liebherr'];
  const ataChapters = ['21', '24', '27', '28', '29', '32', '49', '52', '71'];
  const items: UimMroSeedItem[] = [];

  for (let i = 1; i <= count; i += 1) {
    const category = categoryFor(i);
    const manufacturerName = manufacturers[i % manufacturers.length] || 'CFM';
    const maintenanceCategory = maintenanceCategoryFor(i, category);
    const ataChapter = ataChapters[i % ataChapters.length] || '21';
    const shelfLife = category === 'consumable' ? 365 + (i % 240) : null;
    const hazardousMaterial = category === 'consumable' && i % 9 === 0;

    items.push({
      sku: `UIM-MRO-${pad(i, 6)}`,
      part_number: `MRO-PN-${pad(700000 + i, 8)}`,
      serial_number: `SER-${pad(900000 + i, 8)}`,
      title: `UIM MRO Item ${i}`,
      category,
      manufacturer_name: manufacturerName,
      manufacturer_code: `MFG-${pad(100 + (i % 899), 4)}`,
      ata_chapter_code: ataChapter,
      ata_sub_chapter_code: pad((i % 10) + 1, 2),
      ata_section_code: pad((i % 7) + 1, 2),
      maintenance_category: maintenanceCategory,
      shelf_life_days: shelfLife,
      condition_code: conditionCodeFor(i),
      storage_requirements: {
        temperature: hazardousMaterial ? '2-8C' : 'ambient',
        humidity_max_percent: 60,
        hazmat_zone_required: hazardousMaterial,
      },
      certification_status: certificationStatusFor(i),
      hazardous_material: hazardousMaterial,
      aog_priority: maintenanceCategory === 'emergency-spare',
      quantity: category === 'consumable' ? 10 + (i % 80) : 1,
    });
  }

  return items;
}

export const UIM_MRO_SEED_LIMITS = {
  min: MIN_SEED_COUNT,
  max: MAX_SEED_COUNT,
  default: DEFAULT_SEED_COUNT,
} as const;
