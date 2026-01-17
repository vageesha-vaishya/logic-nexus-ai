import { describe, it, expect } from 'vitest';
import {
  PgDumpErrorCategory,
  classifyPgDumpError,
  buildImportMetrics,
  ImportProgress,
  reorderDataStatementsForImport,
} from './usePgDumpImport';

describe('classifyPgDumpError', () => {
  it('classifies foreign key violations as CONSTRAINT_VIOLATION', () => {
    const message =
      'insert or update on table "child" violates foreign key constraint "child_parent_fkey"';
    const result = classifyPgDumpError(message);
    expect(result.category).toBe(PgDumpErrorCategory.CONSTRAINT_VIOLATION);
    expect(result.severity).toBe('error');
    expect(result.code).toBe(PgDumpErrorCategory.CONSTRAINT_VIOLATION);
  });

  it('classifies transaction aborted as CONSTRAINT_VIOLATION warning', () => {
    const message =
      'current transaction is aborted, commands ignored until end of transaction block';
    const result = classifyPgDumpError(message);
    expect(result.category).toBe(PgDumpErrorCategory.CONSTRAINT_VIOLATION);
    expect(result.severity).toBe('warning');
  });

  it('classifies connection errors as CONNECTION_REFUSED', () => {
    const message = 'could not connect to server: Connection refused';
    const result = classifyPgDumpError(message);
    expect(result.category).toBe(PgDumpErrorCategory.CONNECTION_REFUSED);
    expect(result.severity).toBe('fatal');
  });

  it('classifies syntax errors as INVALID_SYNTAX', () => {
    const message = 'syntax error at or near "FROM"';
    const result = classifyPgDumpError(message);
    expect(result.category).toBe(PgDumpErrorCategory.INVALID_SYNTAX);
    expect(result.severity).toBe('error');
  });
});

describe('buildImportMetrics', () => {
  it('aggregates per-phase timing and totals', () => {
    const importStart = 1_000;
    const importEnd = 5_000;

    const phaseExecutions: Array<{
      name: ImportProgress['currentPhase'];
      startTime: number;
      endTime: number;
      executed: number;
      failed: number;
    }> = [
      {
        name: 'schema',
        startTime: 1_000,
        endTime: 2_000,
        executed: 10,
        failed: 0,
      },
      {
        name: 'data',
        startTime: 2_000,
        endTime: 5_000,
        executed: 100,
        failed: 5,
      },
    ];

    const metrics = buildImportMetrics(importStart, importEnd, phaseExecutions);

    expect(metrics.totalDuration).toBe(importEnd - importStart);

    expect(metrics.phases.schema?.duration).toBe(1_000);
    expect(metrics.phases.schema?.executed).toBe(10);
    expect(metrics.phases.schema?.failed).toBe(0);

    expect(metrics.phases.data?.duration).toBe(3_000);
    expect(metrics.phases.data?.executed).toBe(100);
    expect(metrics.phases.data?.failed).toBe(5);
  });
});

describe('reorderDataStatementsForImport', () => {
  it('orders parent table before child based on foreign key dependencies', () => {
    const parentInsert =
      'INSERT INTO "public"."parents" ("id","name") VALUES (\'p1\', \'Parent One\');';
    const childInsert =
      'INSERT INTO "public"."children" ("id","parent_id","name") VALUES (\'c1\', \'p1\', \'Child One\');';
    const constraint =
      'ALTER TABLE "public"."children" ADD CONSTRAINT "children_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id");';
    const dataStatements = [childInsert, parentInsert];
    const ordered = reorderDataStatementsForImport(
      dataStatements,
      [constraint]
    );
    const parentIndex = ordered.findIndex(s =>
      s.includes('"public"."parents"')
    );
    const childIndex = ordered.findIndex(s =>
      s.includes('"public"."children"')
    );
    expect(parentIndex).toBeGreaterThan(-1);
    expect(childIndex).toBeGreaterThan(-1);
    expect(parentIndex).toBeLessThan(childIndex);
  });
});
