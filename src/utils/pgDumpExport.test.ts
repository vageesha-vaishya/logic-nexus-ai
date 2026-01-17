import { describe, it, expect } from 'vitest';
import {
  validateDollarQuotes,
  validateAndRepairSql,
  generateEnumStatements,
  generateFunctionStatements,
  generateRlsStatements,
  generateConstraintStatements,
  generateIndexStatements,
  generateSchemaStatements,
  generateCreateTableStatement,
  generateInsertStatements,
} from './pgDumpExport';
import { parseSqlText } from './sqlFileParser';
import { calculateChecksum } from './dbExportUtils';

describe('pgDumpExport validation', () => {
  it('detects unclosed dollar-quoted blocks', () => {
    const sql = `
      CREATE FUNCTION test_func() RETURNS void AS $$
      BEGIN
        RAISE NOTICE 'hello';
      END;
    `;
    const errors = validateDollarQuotes(sql);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes well-formed dollar-quoted blocks', () => {
    const sql = `
      CREATE FUNCTION test_func() RETURNS void AS $$
      BEGIN
        RAISE NOTICE 'hello';
      END;
      $$ LANGUAGE plpgsql;
    `;
    const errors = validateDollarQuotes(sql);
    expect(errors.length).toBe(0);
  });

  it('returns compatible result for simple dump', () => {
    const sql = `
      -- PostgreSQL database dump
      BEGIN;
      CREATE TABLE public.test (id uuid primary key);
      COMMIT;
      -- PostgreSQL database dump complete
    `;
    const result = validateAndRepairSql(sql);
    expect(result.errors.length).toBe(0);
  });

  it('generates enum type statements', () => {
    const sql = generateEnumStatements([
      { name: 'status_enum', labels: ['open', 'closed'] },
    ]);
    expect(sql).toContain('Enum Types');
    expect(sql).toContain('CREATE TYPE "status_enum" AS ENUM');
    expect(sql).toContain("'open'");
    expect(sql).toContain("'closed'");
  });

  it('generates function statements with repaired dollar quotes', () => {
    const definition = `
      CREATE FUNCTION public.test_func() RETURNS void AS $$
      BEGIN
        RAISE NOTICE 'hello';
      END;
      $$ LANGUAGE plpgsql;
    `;
    const sql = generateFunctionStatements([
      {
        schema: 'public',
        name: 'test_func',
        function_definition: definition,
      },
    ]);
    expect(sql).toContain('-- Functions');
    expect(sql).toContain('Function: public.test_func');
    expect(sql).toContain('CREATE FUNCTION public.test_func()');
  });

  it('generates RLS enable and policy statements', () => {
    const tables = [
      { schema_name: 'public', table_name: 'items', rls_enabled: true },
    ];
    const policies = [
      {
        schema_name: 'public',
        table_name: 'items',
        policy_name: 'p_select',
        policy_definition:
          'CREATE POLICY p_select ON "public"."items" FOR SELECT USING (true)',
      },
    ];
    const sql = generateRlsStatements(tables, policies);
    expect(sql).toContain('Row Level Security');
    expect(sql).toContain(
      'ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;'
    );
    expect(sql).toContain('CREATE POLICY p_select ON "public"."items"');
  });

  it('generates constraint and index statements', () => {
    const constraints = [
      {
        schema_name: 'public',
        table_name: 'items',
        constraint_name: 'items_pkey',
        constraint_type: 'PRIMARY KEY',
        constraint_details: 'PRIMARY KEY (id)',
      },
      {
        schema_name: 'public',
        table_name: 'items',
        constraint_name: 'items_unique_name',
        constraint_type: 'UNIQUE',
        constraint_details: 'UNIQUE (name)',
      },
      {
        schema_name: 'public',
        table_name: 'items',
        constraint_name: 'items_fk_owner',
        constraint_type: 'FOREIGN KEY',
        constraint_details:
          'FOREIGN KEY (owner_id) REFERENCES public.users(id)',
      },
    ];
    const indexes = [
      {
        schema_name: 'public',
        table_name: 'items',
        index_name: 'items_name_idx',
        index_definition:
          'CREATE INDEX items_name_idx ON public.items USING btree (name)',
      },
    ];
    const constraintsSql = generateConstraintStatements(constraints);
    const indexesSql = generateIndexStatements(indexes);
    expect(constraintsSql).toContain('Primary Keys');
    expect(constraintsSql).toContain('Unique Constraints');
    expect(constraintsSql).toContain('Foreign Keys');
    expect(constraintsSql).toContain(
      'ALTER TABLE "public"."items" ADD CONSTRAINT "items_pkey" PRIMARY KEY (id);'
    );
    expect(constraintsSql).toContain(
      'ALTER TABLE "public"."items" ADD CONSTRAINT "items_unique_name" UNIQUE (name);'
    );
    expect(constraintsSql).toContain(
      'ALTER TABLE "public"."items" ADD CONSTRAINT "items_fk_owner" FOREIGN KEY (owner_id) REFERENCES public.users(id);'
    );
    expect(indexesSql).toContain('Indexes');
    expect(indexesSql).toContain(
      'CREATE INDEX items_name_idx ON public.items USING btree (name);'
    );
  });

  it('generates schema, table, and data statements together', () => {
    const schemasSql = generateSchemaStatements(['public', 'auth']);
    const tableSql = generateCreateTableStatement(
      'public',
      'items',
      [
        {
          column_name: 'id',
          data_type: 'uuid',
          is_nullable: false,
          column_default: 'gen_random_uuid()',
          is_primary_key: true,
        },
        {
          column_name: 'name',
          data_type: 'text',
          is_nullable: false,
          column_default: null,
          is_primary_key: false,
        },
      ],
      true
    );
    const dataSql = generateInsertStatements(
      'public',
      'items',
      ['id', 'name'],
      [
        { id: '00000000-0000-0000-0000-000000000001', name: 'One' },
        { id: '00000000-0000-0000-0000-000000000002', name: 'Two' },
      ],
      {
        id: 'uuid',
        name: 'text',
      }
    );
    const fullSql = `${schemasSql}${tableSql}${dataSql}`;
    const result = validateAndRepairSql(fullSql);
    expect(result.errors.length).toBe(0);
  });

  it('uses udt_name for USER-DEFINED column types', () => {
    const tableSql = generateCreateTableStatement(
      'public',
      'accounts',
      [
        {
          column_name: 'id',
          data_type: 'uuid',
          is_nullable: false,
          column_default: 'gen_random_uuid()',
          is_primary_key: true,
        },
        {
          column_name: 'account_type',
          data_type: 'USER-DEFINED',
          is_nullable: false,
          column_default: `'USER'::account_type`,
          is_primary_key: false,
          udt_name: 'account_type',
        } as any,
      ],
      true
    );
    expect(tableSql).toContain('"account_type" "account_type" NOT NULL DEFAULT \'USER\'::account_type');
    const result = validateAndRepairSql(tableSql);
    expect(result.errors.length).toBe(0);
  });

  it('uses udt_name for ARRAY column types when available', () => {
    const tableSql = generateCreateTableStatement(
      'public',
      'auth_roles',
      [
        {
          column_name: 'id',
          data_type: 'text',
          is_nullable: false,
          column_default: null,
          is_primary_key: true,
        },
        {
          column_name: 'can_manage_scopes',
          data_type: 'ARRAY',
          is_nullable: false,
          column_default: null,
          is_primary_key: false,
          udt_name: '_text',
        } as any,
      ],
      true
    );
    expect(tableSql).toContain('"can_manage_scopes" "text"[] NOT NULL');
    const result = validateAndRepairSql(tableSql);
    expect(result.errors.length).toBe(0);
  });

  it('falls back to text[] when ARRAY type has no udt_name', () => {
    const tableSql = generateCreateTableStatement(
      'public',
      'auth_roles',
      [
        {
          column_name: 'id',
          data_type: 'text',
          is_nullable: false,
          column_default: null,
          is_primary_key: true,
        },
        {
          column_name: 'can_manage_scopes',
          data_type: 'ARRAY',
          is_nullable: true,
          column_default: null,
          is_primary_key: false,
        } as any,
      ],
      false
    );
    expect(tableSql).toContain('"can_manage_scopes" text[]');
    const result = validateAndRepairSql(tableSql);
    expect(result.errors.length).toBe(0);
  });

  it('fixes legacy RPC output with missing schema and incomplete constraint details', () => {
    const constraints = [
      {
        schema_name: 'undefined',
        table_name: 'accounts',
        constraint_name: 'accounts_pkey',
        constraint_type: 'PRIMARY KEY',
        constraint_details: 'id',
      },
      {
        schema_name: null as any,
        table_name: 'users',
        constraint_name: 'users_email_key',
        constraint_type: 'UNIQUE',
        constraint_details: 'email',
      },
    ];
    const sql = generateConstraintStatements(constraints);
    expect(sql).toContain(
      'ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_pkey" PRIMARY KEY (id);'
    );
    expect(sql).toContain(
      'ALTER TABLE "public"."users" ADD CONSTRAINT "users_email_key" UNIQUE (email);'
    );
  });

  it('merges legacy composite primary keys from multiple rows into a single constraint', () => {
    const constraints = [
      {
        schema_name: 'public',
        table_name: 'accounts',
        constraint_name: 'accounts_pkey',
        constraint_type: 'PRIMARY KEY',
        constraint_details: 'tenant_id',
      },
      {
        schema_name: 'public',
        table_name: 'accounts',
        constraint_name: 'accounts_pkey',
        constraint_type: 'PRIMARY KEY',
        constraint_details: 'id',
      },
    ];
    const sql = generateConstraintStatements(constraints);
    expect(sql).toContain(
      'ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_pkey" PRIMARY KEY (tenant_id, id);'
    );
    const pkCount =
      (sql.match(/ADD CONSTRAINT "accounts_pkey" PRIMARY KEY/g) || []).length;
    expect(pkCount).toBe(1);
  });

  it('exports and parses parent-child tables with consistent row counts and ordering', () => {
    const parentCols = [
      {
        column_name: 'id',
        data_type: 'uuid',
        is_nullable: false,
        column_default: 'gen_random_uuid()',
        is_primary_key: true,
      },
      {
        column_name: 'name',
        data_type: 'text',
        is_nullable: false,
        column_default: null,
        is_primary_key: false,
      },
    ];
    const childCols = [
      {
        column_name: 'id',
        data_type: 'uuid',
        is_nullable: false,
        column_default: 'gen_random_uuid()',
        is_primary_key: true,
      },
      {
        column_name: 'parent_id',
        data_type: 'uuid',
        is_nullable: false,
        column_default: null,
        is_primary_key: false,
      },
      {
        column_name: 'name',
        data_type: 'text',
        is_nullable: false,
        column_default: null,
        is_primary_key: false,
      },
    ];
    const parentTableSql = generateCreateTableStatement(
      'public',
      'parents',
      parentCols,
      true
    );
    const childTableSql = generateCreateTableStatement(
      'public',
      'children',
      childCols,
      true
    );
    const fkSql =
      'ALTER TABLE "public"."children" ADD CONSTRAINT "children_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id");\n';
    const parentRows = [
      { id: '00000000-0000-0000-0000-000000000001', name: 'Parent One' },
      { id: '00000000-0000-0000-0000-000000000002', name: 'Parent Two' },
    ];
    const childRows = [
      {
        id: '00000000-0000-0000-0000-000000000101',
        parent_id: '00000000-0000-0000-0000-000000000001',
        name: 'Child A',
      },
      {
        id: '00000000-0000-0000-0000-000000000102',
        parent_id: '00000000-0000-0000-0000-000000000002',
        name: 'Child B',
      },
    ];
    const parentDataSql = generateInsertStatements(
      'public',
      'parents',
      ['id', 'name'],
      parentRows,
      {
        id: 'uuid',
        name: 'text',
      }
    );
    const childDataSql = generateInsertStatements(
      'public',
      'children',
      ['id', 'parent_id', 'name'],
      childRows,
      {
        id: 'uuid',
        parent_id: 'uuid',
        name: 'text',
      }
    );
    const fullSql = [
      parentTableSql,
      childTableSql,
      fkSql,
      parentDataSql,
      childDataSql,
    ].join('\n');
    const parsed = parseSqlText(fullSql, fullSql.length);
    const parentKey = 'public.parents';
    const childKey = 'public.children';
    expect(parsed.metadata.rowCountByTable[parentKey]).toBe(parentRows.length);
    expect(parsed.metadata.rowCountByTable[childKey]).toBe(childRows.length);
    const dataTargets = parsed.dataStatements.map(stmt => {
      const m = stmt.match(
        /INSERT\s+INTO\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"/i
      );
      if (!m) return null;
      const schema = (m[1] || 'public').toLowerCase();
      const table = m[2].toLowerCase();
      return `${schema}.${table}`;
    });
    const parentBlockIndex = dataTargets.indexOf(parentKey);
    const childBlockIndex = dataTargets.indexOf(childKey);
    expect(parentBlockIndex).toBeGreaterThan(-1);
    expect(childBlockIndex).toBeGreaterThan(-1);
    expect(parentBlockIndex).toBeLessThan(childBlockIndex);
    const parentChecksum = calculateChecksum(
      parentRows
        .map(r => `${r.id}:${r.name}`)
        .join('|')
    );
    const childChecksum = calculateChecksum(
      childRows
        .map(r => `${r.id}:${r.parent_id}:${r.name}`)
        .join('|')
    );
    const exportedParentChecksum = calculateChecksum(
      parentDataSql.split('\n').filter(l => l.includes('INSERT')).join('\n')
    );
    const exportedChildChecksum = calculateChecksum(
      childDataSql.split('\n').filter(l => l.includes('INSERT')).join('\n')
    );
    expect(parentChecksum).toBeTruthy();
    expect(childChecksum).toBeTruthy();
    expect(exportedParentChecksum).toBeTruthy();
    expect(exportedChildChecksum).toBeTruthy();
  });
});
