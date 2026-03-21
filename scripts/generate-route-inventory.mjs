import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const apiRoot = path.join(root, 'src/pages/api');
const appFilePath = path.join(root, 'src/App.tsx');
const navigationFilePath = path.join(root, 'src/config/navigation.ts');
const outputPath = path.join(root, 'artifacts/route-inventory.json');

function walkFiles(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function normalizeRoutePath(routePath) {
  return routePath.replace(/\\/g, '/');
}

function parseBooleanEnv(input, fallback = false) {
  const normalized = String(input || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isRouteInventoryEnabled() {
  const directFlag = process.env.ROUTE_INVENTORY_DASHBOARD_V1;
  const viteFlag = process.env.VITE_FF_ROUTE_INVENTORY_DASHBOARD_V1;
  return parseBooleanEnv(directFlag || viteFlag || 'false', false);
}

export function collectApiRoutes() {
  const files = walkFiles(apiRoot)
    .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
    .filter((filePath) => !filePath.includes(`${path.sep}_utils${path.sep}`))
    .filter((filePath) => !/\.test\.tsx?$/.test(filePath));

  const routes = files.map((filePath) => {
    const relative = path.relative(apiRoot, filePath).replace(/\.(ts|tsx)$/, '');
    const withoutIndex = relative.replace(/\/index$/, '');
    return normalizeRoutePath(`/api/${withoutIndex}`);
  });

  return Array.from(new Set(routes)).sort();
}

export function collectAppRoutes() {
  const source = readFileSync(appFilePath, 'utf8');
  const regex = /path\s*=\s*["'`]([^"'`]+)["'`]/g;
  const routes = [];
  let match = regex.exec(source);
  while (match) {
    const route = String(match[1] || '').trim();
    if (route.startsWith('/')) routes.push(route);
    match = regex.exec(source);
  }
  return Array.from(new Set(routes)).sort();
}

export function collectMenuRoutes() {
  const source = readFileSync(navigationFilePath, 'utf8');
  const regex = /path:\s*['"]([^'"]+)['"]/g;
  const routes = [];
  let match = regex.exec(source);
  while (match) {
    const route = String(match[1] || '').trim();
    if (route.startsWith('/')) routes.push(route);
    match = regex.exec(source);
  }
  return Array.from(new Set(routes)).sort();
}

export function generateRouteInventory() {
  const enabled = isRouteInventoryEnabled();
  if (!enabled) {
    return {
      generatedAt: new Date().toISOString(),
      featureFlag: {
        key: 'ROUTE_INVENTORY_DASHBOARD_V1',
        enabled: false,
      },
      web: {
        appRoutes: [],
        menuRoutes: [],
      },
      api: {
        routes: [],
      },
      counts: {
        appRoutes: 0,
        menuRoutes: 0,
        apiRoutes: 0,
      },
    };
  }

  const appRoutes = collectAppRoutes();
  const menuRoutes = collectMenuRoutes();
  const apiRoutes = collectApiRoutes();
  const payload = {
    generatedAt: new Date().toISOString(),
    featureFlag: {
      key: 'ROUTE_INVENTORY_DASHBOARD_V1',
      enabled: true,
    },
    web: {
      appRoutes,
      menuRoutes,
    },
    api: {
      routes: apiRoutes,
    },
    counts: {
      appRoutes: appRoutes.length,
      menuRoutes: menuRoutes.length,
      apiRoutes: apiRoutes.length,
    },
  };
  return payload;
}

export function writeRouteInventory(filePath = outputPath) {
  const inventory = generateRouteInventory();
  const directory = path.dirname(filePath);
  mkdirSync(directory, { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(inventory, null, 2)}\n`);
  return filePath;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const useStdout = process.argv.includes('--stdout');
  const inventory = generateRouteInventory();
  if (useStdout) {
    process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
  } else {
    const writtenPath = writeRouteInventory();
    process.stdout.write(`${writtenPath}\n`);
  }
}
