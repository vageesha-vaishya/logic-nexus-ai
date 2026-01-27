const fs = require('fs');
const path = require('path');

const schemaDir = path.join(__dirname, '../migration_backup_20260127/schema_parts');

function sanitizeFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Remove SET commands (usually at the top)
    content = content.replace(/^SET\s+.*;\s*$/gm, '');

    // 2. Remove SELECT pg_catalog.set_config
    content = content.replace(/^SELECT\s+pg_catalog\.set_config.*;\s*$/gm, '');

    // 3. Remove ALTER OWNER statements
    // Matches: ALTER [OBJECT] [NAME] OWNER TO [ROLE];
    content = content.replace(/^ALTER\s+(?:SCHEMA|TYPE|TABLE|FUNCTION|SEQUENCE|VIEW|MATERIALIZED\s+VIEW)\s+.*?\s+OWNER\s+TO\s+.*?;\s*$/gmi, '');

    // 4. Remove CREATE SCHEMA public (it exists) and its comments
    content = content.replace(/^CREATE\s+SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?"public";\s*$/gmi, '');
    content = content.replace(/^COMMENT\s+ON\s+SCHEMA\s+"public"\s+IS\s+.*;\s*$/gmi, '');

    // 5. Clean up multiple blank lines resulting from deletions
    content = content.replace(/\n{3,}/g, '\n\n');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Sanitized ${path.basename(filePath)}`);
}

// Process all 9 files
for (let i = 1; i <= 9; i++) {
    const fileName = `schema_part_0${i}.sql`;
    const filePath = path.join(schemaDir, fileName);
    if (fs.existsSync(filePath)) {
        sanitizeFile(filePath);
    } else {
        console.warn(`Warning: ${fileName} not found.`);
    }
}
