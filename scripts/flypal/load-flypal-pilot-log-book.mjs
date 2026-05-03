import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import Papa from 'papaparse';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const csvPath = process.argv[2] || path.resolve(
  process.cwd(),
  'tmp',
  'Rep1174308083 copy.csv',
);

const batchSize = Number(process.env.FLYPAL_IMPORT_BATCH_SIZE || 500);
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;

if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL.');
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error(`CSV file not found: ${csvPath}`);
  process.exit(1);
}

const toSnake = (input) => input
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .replace(/_{2,}/g, '_');

const monthMap = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

const parseUtcDateTime = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})\s(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, dd, mon, yyyy, hh, mm] = match;
  const month = monthMap[mon.toLowerCase()];
  if (!month) return null;
  return `${yyyy}-${month}-${dd}T${hh}:${mm}:00Z`;
};

const parseIntervalLiteral = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const [, hours, minutes] = match;
  return `${hours}:${minutes}:00`;
};

const parseNullableInteger = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number(trimmed);
};

const normalizeText = (value) => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length ? trimmed : null;
};

const buildRowHash = (normalizedRow) => {
  const serializable = JSON.stringify(normalizedRow);
  return crypto.createHash('sha256').update(serializable).digest('hex');
};

const parseCsv = () => {
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(csvContent, { header: false, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse failed: ${JSON.stringify(parsed.errors)}`);
  }

  const [headerRow, ...records] = parsed.data;
  const sourceHeaders = headerRow.map((header) => String(header ?? '').trim());
  const headers = sourceHeaders.map((header) => toSnake(header));

  return {
    sourceHeaders,
    headers,
    records,
  };
};

const toRecordObject = (headers, row) => {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index];
  });
  return obj;
};

const validateAndTransform = (rowObj, sourceRowNumber) => {
  const normalized = {
    aircraft: normalizeText(rowObj.aircraft),
    pilot: normalizeText(rowObj.pilot),
    co_pilot: normalizeText(rowObj.co_pilot),
    log_no_log_page_no_flight_no: normalizeText(rowObj.log_no_log_page_no_flight_no),
    classification: normalizeText(rowObj.classification),
    departure_from: normalizeText(rowObj.departure_from),
    arrival_to: normalizeText(rowObj.arrival_to),
    departure_time_utc: parseUtcDateTime(rowObj.departure_time_utc),
    arrival_time_utc: parseUtcDateTime(rowObj.arrival_time_utc),
    block_time: parseIntervalLiteral(rowObj.block_time),
    in_air: parseIntervalLiteral(rowObj.in_air),
    ground: parseIntervalLiteral(rowObj.ground),
    cycle_landing: parseNullableInteger(rowObj.cycle_landing),
    is_processed: false,
    failure_reason: null,
    processed_date: null,
  };

  const errors = [];
  if (!normalized.aircraft) errors.push('aircraft is required');
  if (!normalized.log_no_log_page_no_flight_no) errors.push('log_no_log_page_no_flight_no is required');

  if (rowObj.departure_time_utc && !normalized.departure_time_utc) {
    errors.push('departure_time_utc format must be DD-Mon-YYYY HH:mm');
  }
  if (rowObj.arrival_time_utc && !normalized.arrival_time_utc) {
    errors.push('arrival_time_utc format must be DD-Mon-YYYY HH:mm');
  }
  if (rowObj.block_time && !normalized.block_time) {
    errors.push('block_time format must be H:MM');
  }
  if (rowObj.in_air && !normalized.in_air) {
    errors.push('in_air format must be H:MM');
  }
  if (rowObj.ground && !normalized.ground) {
    errors.push('ground format must be H:MM');
  }
  if (rowObj.cycle_landing && normalized.cycle_landing === null) {
    errors.push('cycle_landing must be integer');
  }
  if (normalized.cycle_landing !== null && normalized.cycle_landing < 0) {
    errors.push('cycle_landing must be >= 0');
  }

  return {
    sourceRowNumber,
    normalized,
    errors,
  };
};

const createDbClient = () => new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const createSupabaseClient = () => {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const buildInsertPayload = (row) => {
  const payload = {
    ...row.normalized,
    source_row_number: row.sourceRowNumber,
  };
  return {
    aircraft: row.normalized.aircraft,
    pilot: row.normalized.pilot,
    co_pilot: row.normalized.co_pilot,
    log_no_log_page_no_flight_no: row.normalized.log_no_log_page_no_flight_no,
    classification: row.normalized.classification,
    departure_from: row.normalized.departure_from,
    arrival_to: row.normalized.arrival_to,
    departure_time_utc: row.normalized.departure_time_utc,
    arrival_time_utc: row.normalized.arrival_time_utc,
    block_time: row.normalized.block_time,
    in_air: row.normalized.in_air,
    ground: row.normalized.ground,
    cycle_landing: row.normalized.cycle_landing,
    is_processed: row.normalized.is_processed,
    failure_reason: row.normalized.failure_reason,
    processed_date: row.normalized.processed_date,
    source_row_hash: buildRowHash(payload),
  };
};

const upsertRowsWithHash = async (client, validRows) => {
  if (!validRows.length) return 0;

  const valuePlaceholders = [];
  const values = [];
  let position = 1;

  for (const row of validRows) {
    const insertPayload = buildInsertPayload(row);
    valuePlaceholders.push(`(
      $${position++}, $${position++}, $${position++}, $${position++}, $${position++},
      $${position++}, $${position++}, $${position++}, $${position++}, $${position++},
      $${position++}, $${position++}, $${position++}, $${position++}, $${position++},
      $${position++}, $${position++}
    )`);

    values.push(
      row.normalized.aircraft,
      row.normalized.pilot,
      row.normalized.co_pilot,
      row.normalized.log_no_log_page_no_flight_no,
      row.normalized.classification,
      row.normalized.departure_from,
      row.normalized.arrival_to,
      row.normalized.departure_time_utc,
      row.normalized.arrival_time_utc,
      row.normalized.block_time,
      row.normalized.in_air,
      row.normalized.ground,
      row.normalized.cycle_landing,
      row.normalized.is_processed,
      row.normalized.failure_reason,
      row.normalized.processed_date,
      insertPayload.source_row_hash,
    );
  }

  const sql = `
    insert into flypal.flypal_pilot_log_book (
      aircraft,
      pilot,
      co_pilot,
      log_no_log_page_no_flight_no,
      classification,
      departure_from,
      arrival_to,
      departure_time_utc,
      arrival_time_utc,
      block_time,
      in_air,
      ground,
      cycle_landing,
      is_processed,
      failure_reason,
      processed_date,
      source_row_hash
    )
    select
      v.aircraft,
      v.pilot,
      v.co_pilot,
      v.log_no_log_page_no_flight_no,
      v.classification,
      v.departure_from,
      v.arrival_to,
      v.departure_time_utc::timestamptz,
      v.arrival_time_utc::timestamptz,
      v.block_time::interval,
      v.in_air::interval,
      v.ground::interval,
      v.cycle_landing::integer,
      v.is_processed::boolean,
      v.failure_reason::text,
      v.processed_date::date,
      v.source_row_hash
    from (values
      ${valuePlaceholders.join(',\n')}
    ) as v(
      aircraft,
      pilot,
      co_pilot,
      log_no_log_page_no_flight_no,
      classification,
      departure_from,
      arrival_to,
      departure_time_utc,
      arrival_time_utc,
      block_time,
      in_air,
      ground,
      cycle_landing,
      is_processed,
      failure_reason,
      processed_date,
      source_row_hash
    )
    on conflict (source_row_hash) do nothing;
  `;

  const result = await client.query(sql, values);
  return result.rowCount ?? 0;
};

const insertErrors = async (client, erroredRows) => {
  if (!erroredRows.length) return 0;

  const valuePlaceholders = [];
  const values = [];
  let position = 1;

  for (const row of erroredRows) {
    valuePlaceholders.push(`($${position++}, $${position++}::jsonb, $${position++})`);
    values.push(row.sourceRowNumber, JSON.stringify(row.raw), row.errors.join('; '));
  }

  const sql = `
    insert into flypal.flypal_pilot_log_book_import_errors (
      source_row_number,
      source_payload,
      error_detail
    )
    values ${valuePlaceholders.join(',\n')};
  `;

  const result = await client.query(sql, values);
  return result.rowCount ?? 0;
};

const run = async () => {
  const { sourceHeaders, headers, records } = parseCsv();

  console.log('Starting FlyPal pilot log CSV load...');
  console.log(`CSV path: ${csvPath}`);
  console.log(`Detected headers: ${sourceHeaders.join(' | ')}`);
  console.log(`Sanitized headers: ${headers.join(' | ')}`);
  console.log(`Rows to process: ${records.length}`);

  let totalInserted = 0;
  let totalErrors = 0;
  let totalProcessed = 0;

  const processBatch = async (chunk, i, writeRows, writeErrors) => {
    const currentBatch = Math.floor(i / batchSize) + 1;
    const validated = chunk.map((row, offset) => {
      const sourceRowNumber = i + offset + 2;
      const obj = toRecordObject(headers, row);
      const transformed = validateAndTransform(obj, sourceRowNumber);
      return {
        ...transformed,
        raw: obj,
      };
    });

    const validRows = validated.filter((item) => item.errors.length === 0);
    const erroredRows = validated.filter((item) => item.errors.length > 0);

    const inserted = await writeRows(validRows);
    const errored = await writeErrors(erroredRows);

    totalInserted += inserted;
    totalErrors += errored;
    totalProcessed += chunk.length;

    console.log(
      `[Batch ${currentBatch}] processed=${chunk.length} inserted=${inserted} errors=${errored} total_processed=${totalProcessed}/${records.length}`,
    );
  };

  const runUsingSupabaseApi = async () => {
    const supabase = createSupabaseClient();
    if (!supabase) {
      throw new Error(
        'Postgres auth failed and Supabase fallback is unavailable. Set VITE_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    console.warn('Postgres authentication failed. Falling back to Supabase API batch import.');

    for (let i = 0; i < records.length; i += batchSize) {
      const chunk = records.slice(i, i + batchSize);

      await processBatch(
        chunk,
        i,
        async (validRows) => {
          if (!validRows.length) return 0;
          const payload = validRows.map((row) => buildInsertPayload(row));
          const { data, error } = await supabase
            .schema('flypal')
            .from('flypal_pilot_log_book')
            .upsert(payload, { onConflict: 'source_row_hash', ignoreDuplicates: true })
            .select('id');
          if (error) throw error;
          return data?.length ?? 0;
        },
        async (erroredRows) => {
          if (!erroredRows.length) return 0;
          const payload = erroredRows.map((row) => ({
            source_row_number: row.sourceRowNumber,
            source_payload: row.raw,
            error_detail: row.errors.join('; '),
          }));
          const { data, error } = await supabase
            .schema('flypal')
            .from('flypal_pilot_log_book_import_errors')
            .insert(payload)
            .select('id');
          if (error) throw error;
          return data?.length ?? 0;
        },
      );
    }

    const { data: verification, error: verificationError } = await supabase
      .schema('flypal')
      .from('flypal_pilot_log_book')
      .select('id,is_processed', { count: 'exact', head: false });
    if (verificationError) throw verificationError;
    const totalRows = verification?.length ?? 0;
    const unprocessedRows = verification?.filter((row) => row.is_processed === false).length ?? 0;

    console.log('Load completed successfully.');
    console.log(`Inserted rows: ${totalInserted}`);
    console.log(`Errored rows logged: ${totalErrors}`);
    console.log(`Table row count verification: ${totalRows}`);
    console.log(`Unprocessed row count verification: ${unprocessedRows}`);
  };

  const client = createDbClient();
  try {
    try {
      await client.connect();
    } catch (connectError) {
      if (connectError?.code === '28P01') {
        await runUsingSupabaseApi();
        return;
      }
      throw connectError;
    }

    for (let i = 0; i < records.length; i += batchSize) {
      const chunk = records.slice(i, i + batchSize);
      await client.query('BEGIN');
      try {
        await processBatch(
          chunk,
          i,
          async (validRows) => upsertRowsWithHash(client, validRows),
          async (erroredRows) => insertErrors(client, erroredRows),
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        const currentBatch = Math.floor(i / batchSize) + 1;
        console.error(`[Batch ${currentBatch}] rollback due to error`);
        console.error(error);
        throw error;
      }
    }

    const verification = await client.query(`
      select
        count(*)::bigint as total_rows,
        count(*) filter (where is_processed = false)::bigint as unprocessed_rows
      from flypal.flypal_pilot_log_book;
    `);

    const totalRows = verification.rows[0]?.total_rows ?? '0';
    const unprocessedRows = verification.rows[0]?.unprocessed_rows ?? '0';

    console.log('Load completed successfully.');
    console.log(`Inserted rows: ${totalInserted}`);
    console.log(`Errored rows logged: ${totalErrors}`);
    console.log(`Table row count verification: ${totalRows}`);
    console.log(`Unprocessed row count verification: ${unprocessedRows}`);
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error('FlyPal pilot log load failed.');
  console.error(error);
  process.exit(1);
});
