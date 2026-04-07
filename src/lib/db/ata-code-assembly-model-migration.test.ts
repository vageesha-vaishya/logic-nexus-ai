import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();
const upMigrationPath = join(
  rootDir,
  'supabase',
  'migrations',
  '20260408123000_create_ata_code_assembly_model_junction.sql',
);
const seedMigrationPath = join(
  rootDir,
  'supabase',
  'migrations',
  '20260408123100_seed_ata_code_assembly_model_junction.sql',
);
const downMigrationPath = join(
  rootDir,
  'supabase',
  'migrations',
  'rollback',
  '20260408123000_create_ata_code_assembly_model_junction.down.sql',
);

describe('ATA code <-> assembly model migration scripts', () => {
  it('defines junction table with PK, FKs, timestamps and indexes', () => {
    const sql = readFileSync(upMigrationPath, 'utf8');

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.ata_code_assembly_model/i);
    expect(sql).toMatch(/PRIMARY KEY\s*\(ata_code_id,\s*assembly_model_id\)/i);
    expect(sql).toMatch(/FOREIGN KEY\s*\(ata_code_id\)\s*REFERENCES public\.ata_codes\(id\)\s*ON DELETE CASCADE/i);
    expect(sql).toMatch(/FOREIGN KEY\s*\(assembly_model_id\)\s*REFERENCES public\.assembly_models\(id\)\s*ON DELETE CASCADE/i);
    expect(sql).toMatch(/created_at\s+timestamptz\s+NOT NULL\s+DEFAULT now\(\)/i);
    expect(sql).toMatch(/updated_at\s+timestamptz\s+NOT NULL\s+DEFAULT now\(\)/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_ata_code_assembly_model_assembly_model_id/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_ata_code_assembly_model_tenant_franchise/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_ata_code_assembly_model_updated_at/i);
  });

  it('includes defensive migration checks and no destructive operations on source tables', () => {
    const sql = readFileSync(upMigrationPath, 'utf8');

    expect(sql).toMatch(/to_regclass\('public\.ata_codes'\)/i);
    expect(sql).toMatch(/to_regclass\('public\.assembly_models'\)/i);
    expect(sql).not.toMatch(/DROP TABLE\s+IF EXISTS\s+public\.ata_codes/i);
    expect(sql).not.toMatch(/DROP TABLE\s+IF EXISTS\s+public\.assembly_models/i);
    expect(sql).not.toMatch(/TRUNCATE\s+TABLE\s+public\.ata_codes/i);
    expect(sql).not.toMatch(/TRUNCATE\s+TABLE\s+public\.assembly_models/i);
  });

  it('seeds associations from existing task templates with safe upsert semantics', () => {
    const sql = readFileSync(seedMigrationPath, 'utf8');

    expect(sql).toMatch(/INSERT INTO public\.ata_code_assembly_model/i);
    expect(sql).toMatch(/FROM public\.task_templates/i);
    expect(sql).toMatch(/INNER JOIN public\.assembly_models/i);
    expect(sql).toMatch(/INNER JOIN public\.ata_codes/i);
    expect(sql).toMatch(/ON CONFLICT\s*\(ata_code_id,\s*assembly_model_id\)\s*DO NOTHING/i);
    expect(sql).not.toMatch(/DELETE FROM public\.ata_codes/i);
    expect(sql).not.toMatch(/DELETE FROM public\.assembly_models/i);
  });

  it('provides reversible down migration script', () => {
    const sql = readFileSync(downMigrationPath, 'utf8');

    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_ata_code_assembly_model_updated_at/i);
    expect(sql).toMatch(/DROP TABLE IF EXISTS public\.ata_code_assembly_model/i);
    expect(sql).toMatch(/BEGIN;/i);
    expect(sql).toMatch(/COMMIT;/i);
  });
});
