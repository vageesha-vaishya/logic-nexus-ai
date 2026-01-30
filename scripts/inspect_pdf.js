
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfLib = require('pdf-parse');

const dataBuffer = fs.readFileSync('scripts/appendix_d.pdf');

console.log('Type of pdfLib:', typeof pdfLib);
console.log('Exports:', Object.keys(pdfLib));

if (typeof pdfLib === 'function') {
    pdfLib(dataBuffer).then(function(data) {
        console.log('Number of pages:', data.numpages);
        // ...
    });
} else if (pdfLib.default && typeof pdfLib.default === 'function') {
     pdfLib.default(dataBuffer).then(function(data) {
        console.log('Number of pages:', data.numpages);
         const lines = data.text.split('\n');
         console.log(lines.slice(0, 100).join('\n'));
    });
}
