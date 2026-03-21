import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function listFiles(dir: string): string[] {
  const absolute = path.join(root, dir);
  const entries = fs.readdirSync(absolute, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(relative));
      continue;
    }
    if (relative.endsWith('.ts') || relative.endsWith('.tsx')) files.push(relative);
  }
  return files;
}

function listPrimitiveUiFiles(): string[] {
  const primitiveFiles = [
    'src/components/ui/button.tsx',
    'src/components/ui/card.tsx',
    'src/components/ui/checkbox.tsx',
    'src/components/ui/input.tsx',
    'src/components/ui/label.tsx',
    'src/components/ui/select.tsx',
    'src/components/ui/switch.tsx',
    'src/components/ui/table.tsx',
    'src/components/ui/tabs.tsx',
    'src/components/ui/textarea.tsx',
    'src/components/ui/tooltip.tsx',
  ];
  const existingPrimitiveFiles = primitiveFiles.filter((file) => fs.existsSync(path.join(root, file)));
  return [...existingPrimitiveFiles, ...listFiles('src/components/ui/enterprise')];
}

describe('UI UX separation architecture', () => {
  it('enforces module-scoped vertical boundary restrictions in lint config', () => {
    const eslintConfig = read('eslint.config.js');
    expect(eslintConfig).toContain('src/features/module-crm/**/*.{ts,tsx}');
    expect(eslintConfig).toContain('src/features/module-logistics/**/*.{ts,tsx}');
    expect(eslintConfig).toContain('src/features/module-quotation/**/*.{ts,tsx}');
    expect(eslintConfig).toContain('src/features/module-finance/**/*.{ts,tsx}');
    expect(eslintConfig).toContain('src/features/module-compliance/**/*.{ts,tsx}');
    expect(eslintConfig).toContain('src/features/module-communications/**/*.{ts,tsx}');
    expect(eslintConfig).toContain('src/features/module-amro/**/*.{ts,tsx}');
    expect(eslintConfig).toContain('@/features/module-logistics/**');
    expect(eslintConfig).toContain('@/features/module-crm/**');
    expect(eslintConfig).toContain('@/features/module-communications/**');
    expect(eslintConfig).toContain('@/features/module-amro/**');
  });

  it('routes vertical workspace entry points through module feature packages', () => {
    const appContent = read('src/App.tsx');
    expect(appContent).toContain('import("./features/module-crm")');
    expect(appContent).toContain('import("./features/module-logistics")');
    expect(appContent).toContain('import("./features/module-quotation")');
    expect(appContent).toContain('import("./features/module-finance")');
    expect(appContent).toContain('import("./features/module-compliance")');
    expect(appContent).toContain('import("./features/module-communications")');
    expect(appContent).toContain('import("./features/module-amro")');
  });

  it('uses platform widget interfaces in vertical page shells', () => {
    const crmShell = read('src/features/module-crm/pages/CRMWorkspaceVerticalPage.tsx');
    const logisticsShell = read('src/features/module-logistics/pages/ShipmentsPipelineVerticalPage.tsx');
    const quotationShell = read('src/features/module-quotation/pages/QuotesPipelineVerticalPage.tsx');
    const communicationsShell = read('src/features/module-communications/pages/CommunicationsHubVerticalPage.tsx');
    const amroShell = read('src/features/module-amro/pages/AmroHubVerticalPage.tsx');
    expect(crmShell).toContain('PlatformWidgetSlot');
    expect(logisticsShell).toContain('PlatformWidgetSlot');
    expect(quotationShell).toContain('QuotationManager');
    expect(communicationsShell).toContain('PlatformWidgetSlot');
    expect(amroShell).toContain('PlatformWidgetSlot');
    expect(crmShell).toContain('data-module-shell="module-crm"');
    expect(logisticsShell).toContain('data-module-shell="module-logistics"');
    expect(quotationShell).toContain('data-module-shell="module-quotation"');
    expect(communicationsShell).toContain('data-module-shell="module-communications"');
    expect(amroShell).toContain('data-module-shell="module-amro"');
  });

  it('keeps data access out of UI primitive libraries', () => {
    const uiFiles = listPrimitiveUiFiles();
    const forbidden = [
      "@/integrations/supabase/client",
      '@/hooks/useCRM',
      '@/lib/db/access',
      "@/services/",
      '@/services/',
    ];
    for (const file of uiFiles) {
      const content = read(file);
      for (const token of forbidden) {
        expect(content.includes(token), `${file} contains ${token}`).toBe(false);
      }
    }
  });
});
