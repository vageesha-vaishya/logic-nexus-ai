import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';

export interface QuotationInputCase {
  caseId: string;
  scenario: string;
  mode: string;
  origin: string;
  destination: string;
  commodity: string;
  weight: string;
  volume: string;
  email: string;
  phone: string;
  expected: 'valid' | 'invalid';
  expectedError: string;
}

const dataRoot = path.resolve(process.cwd(), 'tests/e2e/quotation/data');

export const loadJsonData = async <T>(fileName: string): Promise<T> => {
  const fullPath = path.resolve(dataRoot, fileName);
  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content) as T;
};

export const loadCsvData = async (fileName: string): Promise<QuotationInputCase[]> => {
  const fullPath = path.resolve(dataRoot, fileName);
  const content = await fs.readFile(fullPath, 'utf-8');
  const parsed = Papa.parse<QuotationInputCase>(content, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((error) => error.message).join('; '));
  }
  return parsed.data;
};
