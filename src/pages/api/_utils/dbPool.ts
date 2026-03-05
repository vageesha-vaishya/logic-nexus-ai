import { Pool } from 'pg';
import { ConnectionPoolException, QueryTimeoutException, SQLException } from './errors';

const DEFAULT_POOL_MIN = 10;
const DEFAULT_POOL_MAX = 50;
const DEFAULT_CONN_TIMEOUT_MS = 30_000;
const DEFAULT_QUERY_TIMEOUT_MS = 15_000;

let pool: Pool | null = null;

export type DbPoolConfig = {
  min: number;
  max: number;
  connectionTimeoutMillis: number;
  queryTimeoutMillis: number;
};

export function getDbPoolConfig(): DbPoolConfig {
  return {
    min: Number(process.env.DB_POOL_MIN || DEFAULT_POOL_MIN),
    max: Number(process.env.DB_POOL_MAX || DEFAULT_POOL_MAX),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || DEFAULT_CONN_TIMEOUT_MS),
    queryTimeoutMillis: Number(process.env.DB_QUERY_TIMEOUT_MS || DEFAULT_QUERY_TIMEOUT_MS),
  };
}

export function getDbPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (!pool) {
    const cfg = getDbPoolConfig();
    pool = new Pool({
      connectionString,
      min: cfg.min,
      max: cfg.max,
      connectionTimeoutMillis: cfg.connectionTimeoutMillis,
      query_timeout: cfg.queryTimeoutMillis,
      statement_timeout: cfg.queryTimeoutMillis,
      idleTimeoutMillis: 10_000,
      allowExitOnIdle: true,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });

    pool.on('error', () => {
      // Pool-level errors are converted at query boundaries.
    });
  }

  return pool;
}

export async function runPoolQuery<T = any>(text: string, values: any[] = []): Promise<T[]> {
  const p = getDbPool();
  if (!p) {
    throw new ConnectionPoolException('Database pool is not configured (missing DATABASE_URL)');
  }

  try {
    const res = await p.query(text, values);
    return res.rows as T[];
  } catch (error: any) {
    const message = error?.message || 'Database query failed';
    if (message.toLowerCase().includes('timeout')) {
      throw new QueryTimeoutException(message);
    }
    if (error?.code === 'ECONNREFUSED' || error?.code === '57P01') {
      throw new ConnectionPoolException(message);
    }
    throw new SQLException(message);
  }
}

export async function checkDbPoolHealth(): Promise<boolean> {
  const p = getDbPool();
  if (!p) return false;
  try {
    await p.query('select 1 as ok');
    return true;
  } catch {
    return false;
  }
}
