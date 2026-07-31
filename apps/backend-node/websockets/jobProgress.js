import { ScrapeJob, ScriptExecution } from "../models/index.js";
import { redisSub } from "../redis.js";

export const handleJobProgressWebSocket = async (ws, request, jobId) => {
  console.log(`WebSocket client subscribed to job progress: ${jobId}`);
  
  let job = await ScrapeJob.findById(jobId);
  if (!job) {
    job = await ScriptExecution.findById(jobId);
  }
  
  if (!job) {
    ws.send(JSON.stringify({ error: "Job/Execution not found" }));
    ws.close();
    return;
  }

  // Gửi trạng thái ban đầu
  ws.send(JSON.stringify({
    job_id: job.id,
    status: job.status,
    progress: job.progress,
    error_message: job.error_message,
    completed_at: job.completed_at ? job.completed_at.toISOString() : null,
    logs: job.logs || ""
  }));

  const channel = `job_progress:${jobId}`;
  
  const messageHandler = (message) => {
    try {
      const data = JSON.parse(message);
      ws.send(message);
      if (["completed", "failed", "stopped"].includes(data.status)) {
        redisSub.unsubscribe(channel, messageHandler).catch(console.error);
        ws.close();
      }
    } catch (err) {}
  };

  redisSub.subscribe(channel, messageHandler).catch(console.error);

  ws.on("close", () => {
    redisSub.unsubscribe(channel, messageHandler).catch(console.error);
  });
};
