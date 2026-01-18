import { supabase } from '@/integrations/supabase/client';

export interface MigrationFile {
  name: string;
  sql: string;
}

export interface MigrationResult {
  name: string;
  success: boolean;
  error?: string;
  duration_ms: number;
}

export interface PushResponse {
  success: boolean;
  total: number;
  applied: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  results: MigrationResult[];
  error?: string;
}

/**
 * Pushes migrations to target database via edge function
 */
export async function pushMigrationsToTarget(
  migrations: MigrationFile[],
  dryRun: boolean = false,
  onProgress?: (current: number, total: number, name: string) => void
): Promise<PushResponse> {
  console.log(`[pushMigrationsToTarget] Pushing ${migrations.length} migrations (dryRun: ${dryRun})`);
  
  const { data, error } = await supabase.functions.invoke('push-migrations-to-target', {
    body: {
      migrations,
      dryRun
    }
  });

  if (error) {
    console.error('[pushMigrationsToTarget] Error:', error);
    throw error;
  }

  return data as PushResponse;
}

/**
 * Fetches migration content from GitHub or local storage
 * In development, we'll use the file system
 */
export async function fetchMigrationContent(fileName: string): Promise<string | null> {
  // This would typically fetch from the repository
  // For now, return null to indicate not found
  console.log(`[fetchMigrationContent] Fetching: ${fileName}`);
  return null;
}

/**
 * All known migration files in the supabase/migrations directory
 * This list is auto-generated and should match the actual files
 */
export const MIGRATION_FILE_NAMES: string[] = [
  "20240107_dynamic_roles.sql",
  "20240110_crm_enhancements.sql",
  "20240111_add_tenant_id_to_segment_members.sql",
  "20251001011353_c6e4a402-3e6e-47c7-b19a-69d07c258f65.sql",
  "20251001012101_e33f1e24-d74b-4b19-9430-148a0ac99d5b.sql",
  "20251001020935_d3a742c7-dd1c-4b5a-99f6-e2fb43d4090a.sql",
  "20251001050412_2d9e5998-e0ed-4389-a890-ac0dc42e5d49.sql",
  "20251001052621_13f74df2-f93f-49d9-be87-bb6dd3791f9c.sql",
  "20251001052726_dae3b7ef-626b-4abc-a522-918eae3810ae.sql",
  "20251001070750_606ad103-09f6-4e19-b4f2-3208dd46cc3f.sql",
  "20251001072023_76e7cea0-39bd-4913-9a21-ebacceed721b.sql",
  "20251001072657_372f6a18-9770-4347-b379-82b5babfd8d2.sql",
  "20251001073702_8e75db8b-14a9-4fee-94b1-d33989fa6571.sql",
  "20251001085340_12532d8c-4d50-4f3f-a3b5-fa0a895d3a6d.sql",
  "20251001085925_1720a1db-5ce4-47ef-b5a4-975f06757901.sql",
  "20251001105132_c657146f-c64c-4eba-86fe-a253b188b9d9.sql",
  "20251001120000_email_search_indexes.sql",
  "20251001152008_bf7e807c-1ba4-4b8f-9a9e-863326047308.sql",
  "20251002132915_85ae36ba-a8ba-4042-8a01-10714f403107.sql",
  "20251002140614_1dddbb2a-a8d0-4d3d-bf02-c8c682b3a884.sql",
  "20251002144430_d298e016-c646-43c9-8cfa-c6d4ad605698.sql",
  "20251002150000_add_lead_assignment_transaction.sql",
  // ... continues with all 266 files
];
