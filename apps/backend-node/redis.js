import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const redisConfig = {
  username: process.env.REDIS_USERNAME || 'default',
  password: process.env.REDIS_PASSWORD || '',
  socket: {
    host: process.env.REDIS_HOST || '',
    port: parseInt(process.env.REDIS_PORT || '6379', 10)
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
