import fs from 'fs';
const file = 'src/pages/api/v2/amro/master-data/[entity].ts';
const content = fs.readFileSync(file, 'utf8');
console.log(content.includes('tenantId'));
