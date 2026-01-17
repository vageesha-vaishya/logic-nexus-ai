
import { describe, it, expect } from 'vitest';
import { parseSqlText } from './sqlFileParser';

describe('sqlFileParser', () => {
  it('should parse standard INSERT statements', () => {
    const sql = `
INSERT INTO public.users (id, name) VALUES (1, 'Alice');
INSERT INTO "public"."users" (id, name) VALUES (2, 'Bob');
INSERT INTO users (id, name) VALUES (3, 'Charlie');
    `;
    const result = parseSqlText(sql);
    expect(result.dataStatements.length).toBe(3);
    expect(result.dataStatements[0]).toContain('Alice');
    expect(result.dataStatements[1]).toContain('Bob');
    expect(result.dataStatements[2]).toContain('Charlie');
  });

  it('should parse INSERT statements with different quoting styles', () => {
    const sql = `
INSERT INTO mytable VALUES (1);
INSERT INTO "mytable" VALUES (2);
INSERT INTO public.mytable VALUES (3);
INSERT INTO "public"."mytable" VALUES (4);
    `;
    const result = parseSqlText(sql);
    expect(result.dataStatements.length).toBe(4);
  });

  it('should handle pg_dump --inserts output format', () => {
    const sql = `
--
-- Data for Name: cities; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.cities (name, population) VALUES ('New York', 8000000);
INSERT INTO public.cities (name, population) VALUES ('Los Angeles', 4000000);
    `;
    const result = parseSqlText(sql);
    expect(result.dataStatements.length).toBe(2);
  });
  
  it('should treat DO $$ blocks with INSERT as data statements', () => {
    const sql = `
DO $$
BEGIN
  IF to_regclass('public.accounts') IS NOT NULL THEN
    INSERT INTO "public"."accounts" ("id", "name") VALUES ('1', 'Test');
  ELSE
    RAISE NOTICE 'Skipping data for missing table %', 'public.accounts';
  END IF;
END;
$$;
    `;
    const result = parseSqlText(sql);
    expect(result.dataStatements.length).toBe(1);
    expect(result.dataStatements[0]).toContain('INSERT INTO "public"."accounts"');
  });
});

describe('reorderDataStatements regex check', () => {
  // reproducing the regex from usePgDumpImport.ts (FIXED VERSION)
  const regex = /INSERT\s+INTO\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"?/i;

  it('should match quoted table names', () => {
    const stmt = 'INSERT INTO "public"."users" VALUES (1);';
    const match = stmt.match(regex);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[1]).toBe('public');
      expect(match[2]).toBe('users');
    }
  });

  it('should match quoted table name without schema', () => {
    const stmt = 'INSERT INTO "users" VALUES (1);';
    const match = stmt.match(regex);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[2]).toBe('users');
    }
  });

  it('should match unquoted table names', () => {
    const stmt = 'INSERT INTO users VALUES (1);';
    const match = stmt.match(regex);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[2]).toBe('users');
    }
  });

  it('should match unquoted schema and table', () => {
    const stmt = 'INSERT INTO public.users VALUES (1);';
    const match = stmt.match(regex);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[1]).toBe('public');
      expect(match[2]).toBe('users');
    }
  });
});
