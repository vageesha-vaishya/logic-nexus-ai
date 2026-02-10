
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../src');

function checkFileExists(filePath: string) {
    const fullPath = path.join(projectRoot, filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`❌ File not found: ${filePath}`);
        return false;
    }
    console.log(`✅ Found: ${filePath}`);
    return true;
}

console.log("Checking critical Pipeline files...");

const files = [
    'pages/dashboard/QuotesPipeline.tsx',
    'pages/dashboard/quotes-data.ts',
    'components/sales/kanban/QuotesKanbanBoard.tsx',
    'components/sales/kanban/KanbanColumn.tsx',
    'components/sales/kanban/KanbanCard.tsx',
    'components/sales/QuotesList.tsx',
    'components/sales/analytics/QuoteAnalytics.tsx',
    'components/ui/view-toggle.tsx'
];

let allFound = true;
for (const f of files) {
    if (!checkFileExists(f)) allFound = false;
}

if (allFound) {
    console.log("\nAll critical files exist. The dynamic import error is likely due to:");
    console.log("1. A circular dependency (hard to detect statically without a bundler analysis).");
    console.log("2. A browser caching issue (restart Vite).");
    console.log("3. A syntax error in a file that Node isn't checking here (but 'tsc' would).");
} else {
    console.error("\nMISSING FILES DETECTED! This is likely the cause.");
}
