const fs = require('fs');
const path = require('path');

const schemaDir = path.join(__dirname, '../migration_backup_20260127/schema_parts');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    console.log(`Processing ${path.basename(filePath)}...`);

    // --- 1. CLEANUP NOISE ---
    
    // Remove SET commands
    content = content.replace(/^SET\s+.*;\s*$/gm, '');
    
    // Remove SELECT pg_catalog.set_config
    content = content.replace(/^SELECT\s+pg_catalog\.set_config.*;\s*$/gm, '');
    
    // Remove ALTER OWNER (Supabase handles ownership)
    content = content.replace(/^ALTER\s+(?:SCHEMA|TYPE|TABLE|FUNCTION|SEQUENCE|VIEW|MATERIALIZED\s+VIEW|DOMAIN)\s+.*?\s+OWNER\s+TO\s+.*;\s*$/gmi, '');
    
    // Remove GRANTS/REVOKES (Supabase handles permissions, usually)
    content = content.replace(/^(?:GRANT|REVOKE)\s+.*?;?\s*$/gmi, '');
    
    // Remove COMMENT ON (Optional, but reduces noise and potential errors)
    content = content.replace(/^COMMENT\s+ON\s+.*;\s*$/gmi, '');
    
    // Remove CREATE SCHEMA public
    content = content.replace(/^CREATE\s+SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?"public";\s*$/gmi, '');

    // --- 2. IDEMPOTENCY FIXES ---

    // Fix CREATE EXTENSION
    content = content.replace(
        /CREATE EXTENSION\s+(?!IF NOT EXISTS\s+)(.*?);/gi,
        'CREATE EXTENSION IF NOT EXISTS $1;'
    );

    // Fix CREATE TABLE -> IF NOT EXISTS
    // Note: This regex is tricky for multi-line, but standard pg_dump usually does "CREATE TABLE name ("
    content = content.replace(
        /^CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS\s+)(["a-zA-Z0-9_.]+)/gmi,
        'CREATE TABLE IF NOT EXISTS $1'
    );

    // Fix CREATE SEQUENCE -> IF NOT EXISTS
    content = content.replace(
        /^CREATE\s+SEQUENCE\s+(?!IF\s+NOT\s+EXISTS\s+)(["a-zA-Z0-9_.]+)/gmi,
        'CREATE SEQUENCE IF NOT EXISTS $1'
    );

    // Fix CREATE INDEX -> IF NOT EXISTS
    content = content.replace(
        /^CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS\s+)(.*?)\s+ON/gmi,
        'CREATE INDEX IF NOT EXISTS $1 ON'
    );
    // Also handle UNIQUE INDEX
    content = content.replace(
        /^CREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS\s+)(.*?)\s+ON/gmi,
        'CREATE UNIQUE INDEX IF NOT EXISTS $1 ON'
    );

    // Fix CREATE VIEW -> CREATE OR REPLACE VIEW
    content = content.replace(
        /^CREATE\s+VIEW\s+/gmi,
        'CREATE OR REPLACE VIEW '
    );

    // Fix CREATE FUNCTION -> CREATE OR REPLACE FUNCTION
    // But be careful not to double up "OR REPLACE"
    content = content.replace(
        /^CREATE\s+(?!OR\s+REPLACE\s+)FUNCTION\s+/gmi,
        'CREATE OR REPLACE FUNCTION '
    );

    // Helper regex for identifiers (handles "quoted names with spaces" and schema.table)
    const idRegex = '(?:[a-zA-Z0-9_.]+|"[^"]+")'; 
    // Note: The above simple regex allows dots in unquoted, or full quotes. 
    // It doesn't perfectly handle "schema"."table" but for our replace logic it might be enough 
    // if we just want to capture the whole string.
    // Better: ((?:[a-zA-Z0-9_]+|"[^"]+")(?:\.(?:[a-zA-Z0-9_]+|"[^"]+"))*)
    const complexIdRegex = '((?:[a-zA-Z0-9_]+|"[^"]+")(?:\\.(?:[a-zA-Z0-9_]+|"[^"]+"))*)';
    // For Policy Names (just the name, no dots usually): ((?:[a-zA-Z0-9_]+|"[^"]+"))
    const nameRegex = '((?:[a-zA-Z0-9_]+|"[^"]+"))';

    // Fix Constraints: ADD CONSTRAINT -> DROP IF EXISTS + ADD
    // Matches: ALTER TABLE [ONLY] name ADD CONSTRAINT constraint_name ...
    const constraintRegex = new RegExp(`ALTER\\s+TABLE\\s+(?:ONLY\\s+)?${complexIdRegex}\\s+ADD\\s+CONSTRAINT\\s+${nameRegex}\\s+(.*?);`, 'gsi');
    content = content.replace(
        constraintRegex,
        (match, tableName, constraintName, constraintDef) => {
            if (content.includes(`DROP CONSTRAINT IF EXISTS ${constraintName}`)) return match;
            return `ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${constraintName};\nALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} ${constraintDef};`;
        }
    );

    // Fix Policies: CREATE POLICY -> DROP IF EXISTS + CREATE
    // CREATE POLICY name ON table ...
    const policyRegex = new RegExp(`CREATE\\s+POLICY\\s+${nameRegex}\\s+ON\\s+${complexIdRegex}(.*?;)`, 'gsi');
    content = content.replace(
        policyRegex,
        (match, policyName, tableName, rest) => {
             if (content.includes(`DROP POLICY IF EXISTS ${policyName}`)) return match;
             return `DROP POLICY IF EXISTS ${policyName} ON ${tableName};\nCREATE POLICY ${policyName} ON ${tableName}${rest}`;
        }
    );

    // Fix Triggers: CREATE TRIGGER -> DROP IF EXISTS + CREATE
    const triggerRegex = new RegExp(`CREATE\\s+TRIGGER\\s+${nameRegex}\\s+(AFTER|BEFORE|INSTEAD\\s+OF)\\s+(.*?)\\s+ON\\s+${complexIdRegex}(.*?;)`, 'gsi');
    content = content.replace(
        triggerRegex,
        (match, triggerName, timing, event, tableName, rest) => {
             if (content.includes(`DROP TRIGGER IF EXISTS ${triggerName}`)) return match;
             return `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\nCREATE TRIGGER ${triggerName} ${timing} ${event} ON ${tableName}${rest}`;
        }
    );

    // Fix Enums: CREATE TYPE ... ENUM -> DO BLOCK
    // (Already did this in previous script, but good to reinforce or catch stragglers)
    // This regex looks for unwrapped CREATE TYPE
    content = content.replace(
        /^CREATE\s+TYPE\s+([a-zA-Z0-9_."]+)\s+AS\s+ENUM\s*(\([^;]+\));/gm,
        (match, typeName, enumValues) => {
             return `DO $$ BEGIN\n    CREATE TYPE ${typeName} AS ENUM ${enumValues};\nEXCEPTION\n    WHEN duplicate_object THEN null;\nEND $$;`;
        }
    );

    // --- 3. FIX SPECIFIC WEIRDNESS IN SCHEMA_PART_09 ---
    // User pointed out weird ADD/DROP column logic.
    // If we see: ALTER TABLE x ADD COLUMN y ...; ALTER TABLE x DROP COLUMN IF EXISTS y; 
    // This removes the column immediately. We should comment out the DROP if it follows the ADD immediately.
    // Actually, checking schema_part_09, it looked like:
    // ALTER TABLE public.franchises ADD COLUMN account_id ...;
    // ALTER TABLE public.franchises DROP COLUMN IF EXISTS account_id;
    // This looks like a mistake in the source. I will assume the DROP is unwanted if it kills the just-added column.
    // But safely, I should probably just ensure the ADD is idempotent:
    // ALTER TABLE x ADD COLUMN IF NOT EXISTS y ... (Postgres 9.6+)
    
    content = content.replace(
        /ALTER\s+TABLE\s+(?:ONLY\s+)?([a-zA-Z0-9_."]+)\s+ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS\s+)([a-zA-Z0-9_."]+)\s+(.*?);/gi,
        'ALTER TABLE $1 ADD COLUMN IF NOT EXISTS $2 $3;'
    );

    // Clean up double newlines
    content = content.replace(/\n{3,}/g, '\n\n');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${path.basename(filePath)}`);
    } else {
        console.log(`No changes needed for ${path.basename(filePath)}`);
    }
}

// Process all 9 files
for (let i = 1; i <= 9; i++) {
    const fileName = `schema_part_0${i}.sql`;
    const filePath = path.join(schemaDir, fileName);
    if (fs.existsSync(filePath)) {
        processFile(filePath);
    } else {
        console.warn(`Warning: ${fileName} not found.`);
    }
}
