
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env') });

const dbUrl = process.env.DIRECT_URL;
console.log('Raw DIRECT_URL from env:', dbUrl);

if (!dbUrl) {
    console.error('DIRECT_URL is missing');
    process.exit(1);
}

try {
    const url = new URL(dbUrl);
    console.log('Parsed Password (raw):', url.password);
    console.log('Parsed Password (decoded):', decodeURIComponent(url.password));
    
    // Check if it matches expected
    const expected = "#!January#2026!";
    const decoded = decodeURIComponent(url.password);
    
    if (decoded === expected) {
        console.log('✅ Password matches expected!');
    } else {
        console.log('❌ Password mismatch!');
        console.log('Expected:', expected);
        console.log('Got:', decoded);
    }

} catch (e) {
    console.error('Error parsing URL:', e);
}
