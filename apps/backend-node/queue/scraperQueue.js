import { Queue } from "bullmq";
import Redis from "ioredis";
import { config } from "../config/env.js";

export const connection = new Redis({
  host: config.REDIS_HOST || "127.0.0.1",
  port: config.REDIS_PORT ? parseInt(config.REDIS_PORT, 10) : 6379,
  username: config.REDIS_USERNAME || undefined,
  password: config.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

export const scraperQueue = new Queue("scraperQueue", { connection });
