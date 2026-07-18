import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const redisConfig = {
  username: process.env.REDIS_USERNAME || 'default',
  password: process.env.REDIS_PASSWORD || 'u1QxZM2X34diXL1GBD8Q1ddDBdoOxrLY',
  socket: {
    host: process.env.REDIS_HOST || 'redis-10045.crce178.ap-east-1-1.ec2.cloud.redislabs.com',
    port: parseInt(process.env.REDIS_PORT || '10045', 10)
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
