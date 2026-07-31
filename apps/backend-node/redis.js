import { createClient } from 'redis';
import {config} from './config/env.js'
const redisConfig = {
  username: config.REDIS_USERNAME,
  password: config.REDIS_PASSWORD,
  socket: {
    host: config.REDIS_HOST,
    port: parseInt(config.REDIS_PORT, 10)
  }
};
console.log('redisConfig', redisConfig);
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
