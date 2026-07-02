/**
 * Redis client singleton using ioredis.
 * Configured for both local Redis and Redis Cloud (TLS).
 */

const Redis = require("ioredis");

let client = null;

function getClient() {
  if (!client) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";

    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 5) return null; // Stop retrying after 5 attempts
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
    });

    client.on("connect", () => console.log("[Redis] Connected"));
    client.on("error", (err) => console.error("[Redis] Error:", err.message));
  }

  return client;
}

async function disconnect() {
  if (client) {
    await client.quit();
    client = null;
  }
}

module.exports = { getClient, disconnect };
