import { describe, it, expect } from 'vitest';
import {
  parseSqlText,
  extractTableSchemas,
  buildMissingColumnAlterStatements,
  TableSchemaDefinition,
  TargetColumnInfo,
} from './sqlFileParser';

describe('extractTableSchemas', () => {
  it('parses columns and data types from CREATE TABLE statements', () => {
    const sql = `
      CREATE TABLE public.accounts (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        tenant_id uuid NOT NULL,
        name character varying(255),
        created_at timestamp with time zone,
        amount numeric(10,2) NOT NULL,
        is_active boolean DEFAULT true,
        description text
      );
    `;

    const parsed = parseSqlText(sql);
    const schemas = extractTableSchemas(parsed);

    expect(schemas.length).toBe(1);
    const schema = schemas[0];

    expect(schema.schema).toBe('public');
    expect(schema.table).toBe('accounts');
    expect(schema.columns.length).toBe(7);

    const byName: Record<string, string> = {};
    const nullable: Record<string, boolean> = {};
    schema.columns.forEach((c) => {
      byName[c.column] = c.dataType;
      nullable[c.column] = c.isNullable;
    });

    expect(byName.id.toLowerCase()).toBe('uuid');
    expect(nullable.id).toBe(false);

    expect(byName.tenant_id.toLowerCase()).toBe('uuid');
    expect(nullable.tenant_id).toBe(false);

    expect(byName.name.toLowerCase()).toBe('character varying(255)');
    expect(nullable.name).toBe(true);

    expect(byName.created_at.toLowerCase()).toBe('timestamp with time zone');
    expect(byName.amount.toLowerCase()).toBe('numeric(10,2)');
    expect(nullable.amount).toBe(false);

    expect(byName.is_active.toLowerCase()).toBe('boolean');
    expect(byName.description.toLowerCase()).toBe('text');
  });
});

describe('buildMissingColumnAlterStatements', () => {
  it('generates ALTER TABLE statements for missing columns', () => {
    const sourceSchemas: TableSchemaDefinition[] = [
      {
        schema: 'public',
        table: 'accounts',
        columns: [
          { schema: 'public', table: 'accounts', column: 'id', dataType: 'uuid', isNullable: false },
          { schema: 'public', table: 'accounts', column: 'name', dataType: 'text', isNullable: false },
          { schema: 'public', table: 'accounts', column: 'extra_field', dataType: 'integer', isNullable: true },
        ],
      },
    ];

    const targetColumns: TargetColumnInfo[] = [
      { schema_name: 'public', table_name: 'accounts', column_name: 'id' },
      { schema_name: 'public', table_name: 'accounts', column_name: 'name' },
    ];

    const plan = buildMissingColumnAlterStatements(sourceSchemas, targetColumns);

    expect(plan.missingColumns.length).toBe(1);
    expect(plan.missingColumns[0].column).toBe('extra_field');
    expect(plan.statements.length).toBe(1);
    expect(plan.statements[0]).toBe('ALTER TABLE "public"."accounts" ADD COLUMN "extra_field" integer;');
  });

  it('does not generate statements when all columns exist', () => {
    const sourceSchemas: TableSchemaDefinition[] = [
      {
        schema: 'public',
        table: 'accounts',
        columns: [
          { schema: 'public', table: 'accounts', column: 'id', dataType: 'uuid', isNullable: false },
          { schema: 'public', table: 'accounts', column: 'name', dataType: 'text', isNullable: false },
        ],
      },
    ];

    const targetColumns: TargetColumnInfo[] = [
      { schema_name: 'public', table_name: 'accounts', column_name: 'id' },
      { schema_name: 'public', table_name: 'accounts', column_name: 'name' },
    ];

    const plan = buildMissingColumnAlterStatements(sourceSchemas, targetColumns);

    expect(plan.missingColumns.length).toBe(0);
    expect(plan.statements.length).toBe(0);
  });
});
