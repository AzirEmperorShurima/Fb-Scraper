import { Queue } from "bullmq";
import { config } from "../config/env.js";

export const connection = {
  url: config.REDIS_URL
};

export const scraperQueue = new Queue("scraperQueue", { connection });
