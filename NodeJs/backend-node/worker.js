import { redisClient } from "./redis.js";
import { runScrapingProcess } from "./services/scraperService.js";
import { runScriptProcess } from "./services/scriptService.js";

// Custom Queue API
export const scraperQueue = {
  add: async (name, data) => {
    const job = { id: Date.now().toString(), name, data };
    // Sử dụng redis client gốc (đã connect) để push vào danh sách
    await redisClient.lPush("scraperQueue", JSON.stringify(job));
    console.log(`Đã thêm Job vào hàng chờ: ${name} (ID: ${job.id})`);
  }
};

// Cấu hình concurrency
const CONCURRENCY = 3;

// Hàm khởi chạy worker ảo
const startWorkerLoop = async (workerId) => {
  console.log(`Khởi chạy Worker #${workerId}...`);
  while (true) {
    try {
      if (!redisClient.isReady) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // Dùng rPop + polling thay vì brPop để không làm block (treo) redisClient dùng chung
      const result = await redisClient.rPop("scraperQueue");
      
      if (result) {
        // redis v4 rPop trả về string
        const job = JSON.parse(result);
        console.log(`[Worker #${workerId}] Bắt đầu xử lý Job: ${job.name} (ID: ${job.id})`);
        
        try {
          if (job.name === "scrapeJob") {
            await runScrapingProcess(job.data.jobId, job.data.maxPosts, job.data.fbAccountId);
          } else if (job.name === "scriptJob") {
            await runScriptProcess(job.data.executionId, job.data.script, job.data.fbAccountId);
          }
          console.log(`[Worker #${workerId}] Hoàn thành Job: ${job.name} (ID: ${job.id})`);
        } catch (jobError) {
          console.error(`[Worker #${workerId}] Job ${job.id} bị lỗi:`, jobError);
        }
      } else {
        // Không có job, ngủ 2 giây rồi kiểm tra lại
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (err) {
      console.error(`[Worker #${workerId}] Lỗi kết nối Redis trong lúc lấy Job:`, err);
      // Đợi 5 giây trước khi thử lại để tránh loop vô tận khi Redis sập
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

// Khởi chạy các worker loop chạy song song (mỗi loop là 1 luồng xử lý riêng rẽ)
// Việc gọi bất đồng bộ mà không await sẽ giúp chúng chạy ngầm (background loops)
export const startWorkers = () => {
  for (let i = 1; i <= CONCURRENCY; i++) {
    startWorkerLoop(i);
  }
};

// Tự động start khi file được import
// Chờ 1 giây để redis.js có thời gian connect xong
setTimeout(() => {
  startWorkers();
}, 1000);
