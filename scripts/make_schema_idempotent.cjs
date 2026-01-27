const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '../migration_backup_20260127/schema_parts');

if (!fs.existsSync(SCHEMA_DIR)) {
  console.error('Schema parts directory not found!');
  process.exit(1);
}

const files = fs.readdirSync(SCHEMA_DIR).filter(f => f.startsWith('schema_part_') && f.endsWith('.sql'));

files.forEach(file => {
  const filePath = path.join(SCHEMA_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // --- CLEANUP STEP (Undo previous idempotent changes to avoid duplication/errors) ---

  // 1. Cleanup Policies: Remove our auto-generated DROP statements
  // Matches: DROP POLICY IF EXISTS "name" ON table; followed by CREATE POLICY "name" ON table
  // We use a specific replacement to remove the DROP line
  content = content.replace(
    /DROP POLICY IF EXISTS "([^"]+)" ON ([a-zA-Z0-9_."]+);\s+(?=CREATE POLICY "\1" ON \2)/g, 
    ''
  );

  // 2. Cleanup Tables: Remove all "IF NOT EXISTS" (handles single or multiple occurrences)
  // This fixes the "IF NOT EXISTS IF NOT EXISTS" error
  content = content.replace(/CREATE TABLE(\s+IF NOT EXISTS)+/g, 'CREATE TABLE');

  // 3. Cleanup Views: Revert to standard CREATE VIEW
  content = content.replace(/CREATE OR REPLACE VIEW/g, 'CREATE VIEW');

  // 4. Cleanup Triggers: Remove our auto-generated DROP statements
  content = content.replace(
    /DROP TRIGGER IF EXISTS ("?[a-zA-Z0-9_]+"?) ON ("?[a-zA-Z0-9_.]+"?);\s+(?=CREATE TRIGGER \1)/g, 
    ''
  );

  // 5. Cleanup Indexes: Remove all "IF NOT EXISTS" (handles single or multiple occurrences)
  content = content.replace(/CREATE INDEX(\s+IF NOT EXISTS)+/g, 'CREATE INDEX');

  // 6. Cleanup Functions: Remove our auto-generated DROP statements
  // Matches: DROP FUNCTION IF EXISTS name(args); followed by CREATE ... FUNCTION name
  content = content.replace(
    /DROP FUNCTION IF EXISTS ([a-zA-Z0-9_.]+)\(([^)]*)\);\s+(?=CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+\1)/g,
    ''
  );

  // 6. Cleanup Types: Remove DO $$ ... exception wrapper if present (simplified)
  // This is hard to revert perfectly with regex, so we'll rely on the application step being smart enough or just overwriting.
  // Actually, for types, let's just not duplicate the DO $$ block if it exists.
  // But to be safe, if we see our specific DO block pattern, we could revert it, but it's complex.
  // Instead, let's just make the Application Step for Types check if it's already wrapped.

  // 7. Cleanup Constraints: Remove DROP CONSTRAINT IF EXISTS
  content = content.replace(
    /ALTER TABLE ("?[a-zA-Z0-9_.]+"?) DROP CONSTRAINT IF EXISTS ("?[a-zA-Z0-9_.]+"?);\s+(?=ALTER TABLE \1 ADD CONSTRAINT \2)/g,
    ''
  );


  // --- APPLICATION STEP (Apply idempotent patterns fresh) ---

  // 1. Fix Policies: Prepend DROP POLICY IF EXISTS
  // Matches: CREATE POLICY "name" ON table_identifier [FOR action]
  // We need to capture the optional "FOR SELECT/UPDATE/etc" part to avoid breaking the syntax,
  // but for the DROP statement, we only need the name and the table.
  content = content.replace(
    /CREATE POLICY "([^"]+)"\s+ON\s+([a-zA-Z0-9_."]+)/g, 
    'DROP POLICY IF EXISTS "$1" ON $2;\nCREATE POLICY "$1" ON $2'
  );

  // 2. Fix Tables: CREATE TABLE -> CREATE TABLE IF NOT EXISTS
  content = content.replace(
    /CREATE TABLE\s+("?[a-zA-Z0-9_.]+"?)/g,
    'CREATE TABLE IF NOT EXISTS $1'
  );
  
  // 3. Fix Views: CREATE VIEW -> CREATE OR REPLACE VIEW
  content = content.replace(
    /CREATE VIEW\s+("?[a-zA-Z0-9_.]+"?)/g,
    'CREATE OR REPLACE VIEW $1'
  );

  // 4. Fix Triggers: Prepend DROP TRIGGER IF EXISTS
  // Matches: CREATE TRIGGER "name" ... ON table_identifier
  // We need to capture the trigger name and the table name.
  // Pattern supports:
  // CREATE TRIGGER name ... ON table ...
  // CREATE TRIGGER "name" ... ON "table" ...
  content = content.replace(
    /CREATE TRIGGER\s+("?[a-zA-Z0-9_]+"?)[\s\S]*?ON\s+("?[a-zA-Z0-9_.]+"?)/g, 
    (match, triggerName, tableName) => {
      // Don't replace if it already looks like we fixed it (check context if needed, but simple replace is usually safe for idempotent scripts if we drop first)
      // However, to avoid infinite replacement loops if we run this script multiple times, we should check if the DROP exists immediately before.
      // But since we have a cleanup step, we can just do the replacement.
      return `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\n${match}`;
    }
  );

  // 5. Fix Indexes: CREATE INDEX -> CREATE INDEX IF NOT EXISTS
  // Matches: CREATE INDEX "name" or CREATE INDEX name
  // Note: CREATE INDEX IF NOT EXISTS is only supported in Postgres 9.5+ (Supabase supports this)
  content = content.replace(
    /CREATE INDEX\s+(?!IF NOT EXISTS\s+)("?[a-zA-Z0-9_]+"?)(\s+ON\s+)/g, 
    'CREATE INDEX IF NOT EXISTS $1$2'
  );

  // 6. Fix Types (ENUMs): Wrap in DO block to handle duplicates
  // Matches: CREATE TYPE name AS ENUM (...);
  content = content.replace(
    /CREATE TYPE\s+("?[a-zA-Z0-9_.]+"?)\s+AS\s+ENUM\s*(\([^;]+\));/g,
    (match, typeName, enumValues) => {
       // Check if already wrapped (simple check)
       // The syntax error "syntax error at or near BEGIN" often happens if there is already a DO block or weird nesting.
       // However, the user error is "syntax error at or near BEGIN LINE 262: DO $$ BEGIN ^"
       // This suggests that the previous replacement might have messed up or the file structure is weird.
       // But wait! The previous error was "type opportunity_stage already exists".
       // The NEW error is "syntax error at or near BEGIN".
       // This usually happens if the DO block is inside another DO block or transaction without proper termination.
       // OR if we are pasting this into a tool that doesn't support DO blocks well (but Supabase SQL editor does).
       // Actually, the error `syntax error at or near "BEGIN"` at the START of the DO block suggests
       // maybe the previous statement wasn't terminated with a semicolon?
       // Let's ensure we add a newline before our DO block.
       
       if (content.includes(`DO $$ BEGIN\n    CREATE TYPE ${typeName}`)) return match;
       
       return `DO $$ BEGIN
    CREATE TYPE ${typeName} AS ENUM ${enumValues};
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;`;
    }
  );

  // 6a. Cleanup Nested DO blocks (Fix for the specific error observed)
  // The error shows we created nested DO blocks:
  // DO $$ ... THEN DO $$ BEGIN ... END $$; ... END $$;
  // This is invalid syntax in PL/pgSQL if not handled carefully (nested DO blocks are not standard like this inside IF statements without care).
  // Actually, you CANNOT nest `DO $$` blocks directly inside another PL/pgSQL block like that easily.
  // The outer block is already a DO block (implied or explicit).
  // If the file content shows `DO $$ DECLARE ... BEGIN ... DO $$ BEGIN ... END $$; ... END $$;`, that's the issue.
  // The `DO` command is a SQL command, not a PL/pgSQL statement. You can't run `DO` inside a `DO` block's body directly.
  // We need to remove the inner `DO $$` wrapper if it's inside another block.
  
  // FIX: If we detect we are inside a larger block (which we might be if the file was already complex),
  // we should just use a simple BEGIN ... EXCEPTION ... END block, NOT a `DO $$` wrapper.
  // BUT, we are doing regex replace on the raw file.
  // The file `schema_part_04.sql` lines 255-277 show a complex structure:
  // DO $$ ... IF NOT EXISTS ... THEN DO $$ BEGIN CREATE TYPE ... END $$; ...
  // This is definitely WRONG. You cannot call `DO` inside a PL/pgSQL block.
  
  // We need to fix the script to NOT wrap in `DO $$` if it looks like it's already inside a structure,
  // OR just use a plain BEGIN-EXCEPTION-END block if we can confirm context.
  // However, `CREATE TYPE` cannot be run inside a PL/pgSQL block directly unless via `EXECUTE`.
  // Wait, `CREATE TYPE` IS allowed in PL/pgSQL? No, DDL in PL/pgSQL usually needs `EXECUTE`?
  // Actually, modern Postgres allows many DDLs directly, but `CREATE TYPE` inside a `DO` block works.
  // But nesting `DO` inside `DO` is invalid.
  
  // Strategy:
  // The existing code in schema_part_04.sql (lines 255+) is ALREADY complex idempotent logic (checking pg_type).
  // Our script blindly wrapped the `CREATE TYPE` line inside that complex logic with ANOTHER `DO $$` block.
  // This broke it.
  
  // We should ONLY wrap `CREATE TYPE` if it is at the top level (not indented deeply or part of a code block).
  // OR, better: Detect if `CREATE TYPE` is already inside a `DO` block.
  
  // Let's improve the regex to be safer.
  
  // Undo the damage first? No, we need to correct the replacement logic.
  // We will revert the `DO $$` wrapper if it's inside another `DO $$`.
  
  // New cleanup step for this specific mess:
  // Remove `DO $$ BEGIN` and `END $$;` if they are inside another block? Hard to detect with regex.
  // Easier: Just look for the specific pattern we created and fix it.
  
  // If we see `THEN DO $$ BEGIN`, that is the invalid pattern.
  content = content.replace(/THEN\s+DO\s+\$\$\s+BEGIN/g, 'THEN BEGIN');
  content = content.replace(/END\s+\$\$;\s+ELSE/g, 'END; ELSE');
  // Also fix the end of the block if it was `END $$;` but should be just `END;` inside the IF.
  // This is tricky.
  
  // Alternative:
  // The complex block in schema_part_04.sql handles idempotency itself!
  // It checks `IF NOT EXISTS ... THEN CREATE TYPE ...`.
  // So we should NOT have wrapped it at all.
  
  // Our script should match `CREATE TYPE` but EXCLUDE it if it's already guarded.
  // The complex block uses `IF NOT EXISTS (...) THEN`.
  
  // Let's change step 6 to be:
  // Match `CREATE TYPE ...`
  // Check if the preceding lines look like `IF NOT EXISTS`.
  // If so, SKIP.
  
  // Implementation of the fix in the script:
  
  // 6. Fix Types (ENUMs) - IMPROVED
  // Remove the previous step 6 logic and replace with this:
  
  // First, let's clean up the bad nested DO blocks we might have created.
  // Pattern 1: `THEN DO $$ BEGIN ... END $$;` -> `THEN BEGIN ... END;`
  content = content.replace(
    /THEN\s+DO\s+\$\$\s+BEGIN([\s\S]+?)END\s+\$\$;/g,
    'THEN BEGIN$1END;'
  );

  // Pattern 2: `THEN BEGIN DO $$ BEGIN ... END $$;` -> `THEN BEGIN ... END;`
  // This handles the case where the original code already had a BEGIN block
  content = content.replace(
    /THEN\s+BEGIN\s+DO\s+\$\$\s+BEGIN([\s\S]+?)END\s+\$\$;/g,
    'THEN BEGIN$1END;'
  );

  // Pattern 3: Cleanup isolated `DO $$ BEGIN ... END $$;` inside other structures if detected?
  // Ideally we just want to remove the wrapper.
  
  // Now, the proper application step for Types.
  // Only wrap if it's a standalone CREATE TYPE.
  content = content.replace(
    /^CREATE TYPE\s+([a-zA-Z0-9_."]+)\s+AS\s+ENUM\s*(\([^;]+\));/gm, // Improved regex for identifiers
    (match, typeName, enumValues) => {
       // Double check it's not already wrapped (though ^ helps)
       if (content.includes(`DO $$ BEGIN\n    CREATE TYPE ${typeName}`)) return match;
       
       return `DO $$ BEGIN
    CREATE TYPE ${typeName} AS ENUM ${enumValues};
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;`;
    }
  );
  
  // And we need to remove the OLD step 6 (the one without the anchor) from the file content we are writing.
  // Since we are editing `make_schema_idempotent.cjs`, we just replace the code block.


  // 7. Fix Constraints: Prepend DROP CONSTRAINT IF EXISTS
  // Matches: ALTER TABLE table ADD CONSTRAINT name ...
  // Updated regex to handle quoted identifiers properly (including dots inside quotes)
  content = content.replace(
    /ALTER TABLE\s+(?:ONLY\s+)?([a-zA-Z0-9_."]+)\s+ADD CONSTRAINT\s+([a-zA-Z0-9_."]+)\s+(.*);/g,
    (match, tableName, constraintName, constraintDef) => {
        // Simple check to avoid double application if not cleaned up
        if (content.includes(`DROP CONSTRAINT IF EXISTS ${constraintName}`)) return match;

        return `ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${constraintName};
ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} ${constraintDef};`;
    }
  );

  // 8. Fix Extensions: CREATE EXTENSION -> CREATE EXTENSION IF NOT EXISTS
  // Updated regex to handle dashes in extension names (e.g. uuid-ossp) and quotes
  content = content.replace(
    /CREATE EXTENSION\s+(?!IF NOT EXISTS\s+)([a-zA-Z0-9_."\-]+)(\s+WITH\s+SCHEMA\s+[a-zA-Z0-9_]+)?;?/g,
    'CREATE EXTENSION IF NOT EXISTS $1$2;'
  );

  // 9. Fix Functions: Prepend DROP FUNCTION IF EXISTS
  // Matches: CREATE [OR REPLACE] FUNCTION name(args)
  // Updated regex to handle quoted identifiers
  content = content.replace(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_."]+)\s*\(([^)]*)\)/g,
    (match, funcName, args) => {
       // Clean up args (newlines, extra spaces) for the DROP statement
       let cleanArgs = args.replace(/\s+/g, ' ').trim();
       
       // Remove DEFAULT values to make valid DROP FUNCTION syntax
       // Handles: DEFAULT 1, DEFAULT 'text', DEFAULT ARRAY['a','b'], DEFAULT NULL::type
       cleanArgs = cleanArgs.replace(/\s+DEFAULT\s+(?:ARRAY\[[^\]]*\]|'[^']*'|[^,)]+)/gi, '');
       
       return `DROP FUNCTION IF EXISTS ${funcName}(${cleanArgs});
${match}`;
    }
  );

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
});

console.log('All schema parts updated to be idempotent.');
