import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const redisConfig = {
  password: process.env.REDIS_PASSWORD || undefined,
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    tls: process.env.REDIS_TLS === 'true'
  }
};

export const redisPub = createClient(redisConfig);
export const redisSub = createClient(redisConfig);
export const redisClient = createClient(redisConfig);

redisPub.on('error', (err) => console.error('Redis Pub Error:', err));
redisSub.on('error', (err) => console.error('Redis Sub Error:', err));
redisClient.on('error', (err) => console.error('Redis Client Error:', err));

// Kết nối ngay khi module được nạp
(async () => {
  try {
    await redisPub.connect();
    await redisSub.connect();
    await redisClient.connect();
    console.log("Redis connected successfully.");
  } catch (e) {
    console.error("Failed to connect to Redis", e);
  }
})();
