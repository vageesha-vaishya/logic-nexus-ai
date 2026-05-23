import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { handleUimMockRequest } from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(serviceRoot, '..', '..');

dotenv.config({ path: path.join(workspaceRoot, '.env') });
dotenv.config({ path: path.join(workspaceRoot, '.env.local'), override: true });
dotenv.config({ path: path.join(serviceRoot, '.env'), override: true });

const PORT = Number(process.env.PORT || 3000);

const server = createServer((req, res) => {
  handleUimMockRequest(req, res).catch((error) => {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Unhandled uim-api mock error',
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[uim-api] dev mock listening on port ${PORT}`);
});
