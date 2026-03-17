type CacheClient = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: 'EX', ttl: number) => Promise<unknown>;
};

let cacheClientPromise: Promise<CacheClient | null> | null = null;

async function buildClient(): Promise<CacheClient | null> {
  const redisUrl = String(process.env.REDIS_URL || '').trim();
  if (!redisUrl) return null;
  const { default: Redis } = await import('ioredis');
  const client = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  return client as unknown as CacheClient;
}

async function getClient(): Promise<CacheClient | null> {
  if (!cacheClientPromise) {
    cacheClientPromise = buildClient().catch(() => {
      cacheClientPromise = null;
      return null;
    });
  }
  return cacheClientPromise;
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const client = await getClient();
  if (!client) return null;
  const raw = await client.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const client = await getClient();
  if (!client) return;
  await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}
