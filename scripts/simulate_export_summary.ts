
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Helper to read .env file
function loadEnv() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(__dirname, '../.env');
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[key] = value;
      }
    });
    return env;
  }
  return {};
}

const env = loadEnv();
const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['VITE_SUPABASE_PUBLISHABLE_KEY']; // Using anon key for public RPCs, or service role if available?
// The component uses the client from useCRM, which usually uses the public key but with an authenticated session.
// However, for this simulation, if RLS is enabled on system tables (unlikely for RPCs usually), we might need service role key if available.
// But standard client uses anon key.
// Let's try with VITE_SUPABASE_PUBLISHABLE_KEY.

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function simulateExport() {
  console.log('Starting export simulation...');
  const exportedObjects: { type: string; name: string }[] = [];
  const counts = {
    tables: 0,
    enums: 0,
    functions: 0,
    indexes: 0,
    constraints: 0,
    policies: 0,
    edge_functions: 0,
    data_rows: 0
  };

  try {
    // 1. Tables (and Enums/Functions indirectly via schema query if we had one, but component uses separate logic)
    // The component uses get_all_database_schema to get columns, but loadTables uses get_all_database_tables.
    // Let's use get_all_database_tables to get the list of tables.
    
    console.log('Fetching tables...');
    const { data: tablesData, error: tablesError } = await supabase.rpc('get_all_database_tables');
    if (tablesError) {
       console.warn('get_all_database_tables failed, falling back to public schema only (get_database_tables)');
       // Fallback logic
       const { data: fallbackData, error: fallbackError } = await supabase.rpc('get_database_tables');
       if (fallbackError) throw fallbackError;
       if (fallbackData) {
         fallbackData.forEach((t: any) => {
            exportedObjects.push({ type: 'Table', name: `public.${t.table_name}` });
            counts.tables++;
         });
       }
    } else if (tablesData) {
       tablesData.forEach((t: any) => {
          exportedObjects.push({ type: 'Table', name: `${t.schema_name}.${t.table_name}` });
          counts.tables++;
       });
    }

    // 2. Indexes
    console.log('Fetching indexes...');
    const { data: indexesData, error: indexesError } = await supabase.rpc('get_table_indexes');
    if (indexesError) {
        console.error('Error fetching indexes:', indexesError.message);
    } else if (indexesData) {
        indexesData.forEach((index: any) => {
            if (index.index_definition && index.index_definition.trim().length > 0) {
                 counts.indexes++;
                 if (index.index_name) {
                     exportedObjects.push({ type: 'Index', name: `${index.table_name}.${index.index_name}` });
                 }
            }
        });
    }

    // 3. Constraints
    console.log('Fetching constraints...');
    const { data: constraintsData, error: constraintsError } = await supabase.rpc('get_table_constraints');
    if (constraintsError) {
        console.error('Error fetching constraints:', constraintsError.message);
    } else if (constraintsData) {
        constraintsData.forEach((constraint: any) => {
             const type = (constraint.constraint_type || '').toUpperCase();
             const details = (constraint.constraint_details || '').toString();
             const isPkOrUnique = type === 'PRIMARY KEY' || type === 'UNIQUE' || 
                                  details.toUpperCase().startsWith('PRIMARY KEY') || 
                                  details.toUpperCase().startsWith('UNIQUE');
             
             if (!isPkOrUnique && details.trim().length > 0) {
                 counts.constraints++;
                 exportedObjects.push({ 
                     type: 'Foreign Key/Check Constraint', 
                     name: `${constraint.schema_name}.${constraint.table_name}.${constraint.constraint_name}` 
                 });
             }
        });
    }

    // 4. RLS Policies
    console.log('Fetching RLS policies...');
    let { data: policiesData, error: policiesError } = await supabase.rpc('get_all_rls_policies');
    
    if (policiesError && (policiesError.message.includes('function') || policiesError.message.includes('does not exist'))) {
         console.warn('get_all_rls_policies not found, falling back to get_rls_policies');
         const res = await supabase.rpc('get_rls_policies');
         policiesData = res.data;
         policiesError = res.error;
    }

    if (policiesError) {
         // This might fail if the RPC doesn't exist or permissions issue
         console.error('Error fetching RLS policies:', policiesError.message);
    } else if (policiesData) {
        policiesData.forEach((policy: any) => {
            counts.policies++;
            const schema = policy.schema_name || 'public';
            exportedObjects.push({
                type: 'RLS Policy',
                name: `${schema}.${policy.table_name}.${policy.policy_name}`
            });
        });
    }

    // 5. Edge Functions
    console.log('Fetching Edge Functions...');
    try {
        const { data: functionsData, error: functionsError } = await supabase.functions.invoke('list-edge-functions');
        if (functionsError) {
             console.error('Error fetching edge functions:', functionsError.message);
        } else if (functionsData && Array.isArray(functionsData.edge_functions)) {
             counts.edge_functions = functionsData.edge_functions.length;
             functionsData.edge_functions.forEach((fn: any) => {
                 const name = fn?.slug || fn?.name || fn?.id || 'edge_function';
                 exportedObjects.push({ type: 'Edge Function', name });
             });
        }
    } catch (e: any) {
        console.error('Exception fetching edge functions:', e.message);
    }
    
    // Generate Summary
    const totalObjects = exportedObjects.length;
    const objectsByType = exportedObjects.reduce((acc: Record<string, number>, obj) => {
      acc[obj.type] = (acc[obj.type] || 0) + 1;
      return acc;
    }, {});

    const headerSection = [
      "=== Database Export Summary ===",
      `Export Date/Time: ${new Date().toISOString()}`,
      ""
    ];

    const detailedListingSection = [
      "=== Detailed Object Listing ===",
      ...exportedObjects.map((obj) => `- [${obj.type}] ${obj.name}`),
      ""
    ];

    const statisticsSection = [
      "=== Statistics ===",
      ...Object.entries(objectsByType).map(
        ([type, count]) => `- ${type}: ${count}`
      ),
      `- Total Objects Exported: ${totalObjects}`,
      ""
    ];

    const footerSection = [
      "=== Footer ===",
      `Export Completion Status: Simulated Success`,
      "",
      `Tables: ${counts.tables}`,
      `Enums: ${counts.enums} (Not fetched in simulation)`,
      `Functions: ${counts.functions} (Not fetched in simulation)`,
      `Indexes: ${counts.indexes}`,
      `Constraints: ${counts.constraints}`,
      `RLS Policies: ${counts.policies}`,
      `Edge Functions: ${counts.edge_functions}`,
      `Data Rows Exported: ${counts.data_rows} (Not fetched in simulation)`,
    ];

    const structuredSummary = [
      ...headerSection,
      ...detailedListingSection,
      ...statisticsSection,
      ...footerSection,
    ];

    console.log('\nGenerated Export Summary:\n');
    console.log(structuredSummary.join('\n'));
    
    // Write to file
    fs.writeFileSync('export_summary.txt', structuredSummary.join('\n'));
    console.log('\nSaved to export_summary.txt');

  } catch (err: any) {
    console.error('Simulation failed:', err);
  }
}

simulateExport();
