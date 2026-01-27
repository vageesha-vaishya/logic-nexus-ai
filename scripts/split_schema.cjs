const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SCHEMA_FILE = path.join(__dirname, '../migration_backup_20260127/full_schema.sql');
const OUTPUT_DIR = path.join(__dirname, '../migration_backup_20260127/schema_parts');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function splitSchema() {
  const fileStream = fs.createReadStream(SCHEMA_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let partNum = 1;
  let lineCount = 0;
  let currentChunk = [];
  const MAX_LINES = 5000;

  console.log(`Splitting ${SCHEMA_FILE} into parts...`);

  for await (const line of rl) {
    currentChunk.push(line);
    lineCount++;

    // Try to split on a safe boundary (empty line) after MAX_LINES
    if (lineCount >= MAX_LINES && line.trim() === '') {
        await writePart(partNum, currentChunk);
        partNum++;
        currentChunk = [];
        lineCount = 0;
    }
  }

  // Write remaining lines
  if (currentChunk.length > 0) {
    await writePart(partNum, currentChunk);
  }

  console.log('Done!');
}

async function writePart(num, lines) {
    const fileName = `schema_part_${String(num).padStart(2, '0')}.sql`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Created ${fileName} (${lines.length} lines)`);
}

splitSchema();
