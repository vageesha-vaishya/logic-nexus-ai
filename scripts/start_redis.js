import { RedisMemoryServer } from 'redis-memory-server';

async function startRedis() {
  console.log("Starting Redis Memory Server...");
  const redisServer = new RedisMemoryServer({
    instance: {
      port: 6379, // Try to bind to standard port
    },
  });

  if (await redisServer.start()) {
    const host = await redisServer.getHost();
    const port = await redisServer.getPort();
    console.log(`✅ Redis server running at ${host}:${port}`);
  } else {
    console.error("❌ Failed to start Redis server.");
  }
  
  // Keep process alive
  setInterval(() => {}, 1000);
}

startRedis();
