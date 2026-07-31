import { Worker } from "bullmq";
import { connection } from "./scraperQueue.js";
import { runScrapingProcess } from "../services/scraperService.js";
import { runScriptProcess } from "../services/scriptService.js";

const CONCURRENCY = 3;

export const scraperWorker = new Worker(
  "scraperQueue",
  async (job) => {
    console.log(`[Worker] Bắt đầu xử lý Job: ${job.name} (ID: ${job.id})`);
    
    if (job.name === "scrapeJob") {
      await runScrapingProcess(job.data.jobId, job.data.maxPosts, job.data.fbAccountIds);
    } else if (job.name === "scriptJob") {
      await runScriptProcess(job.data.executionId, job.data.script, job.data.fbAccountIds);
    }
    
    console.log(`[Worker] Hoàn thành Job: ${job.name} (ID: ${job.id})`);
  },
  {
    connection,
    concurrency: CONCURRENCY
  }
);

scraperWorker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} bị lỗi:`, err);
});
