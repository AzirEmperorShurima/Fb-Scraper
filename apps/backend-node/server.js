import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { initDatabase } from "./database.js";
import { User, ScrapeJob, ScriptExecution } from "./models/index.js";
import { SECRET_KEY, authenticateToken } from "./middleware/auth.js";
import { redisSub } from "./redis.js";
import "./worker.js";

import authRouter from "./routes/auth.js";
import configRouter from "./routes/config.js";
import jobsRouter from "./routes/jobs.js";
import exportsRouter from "./routes/exports.js";
import analyticsRouter from "./routes/analytics.js";
import googleAuthRouter from "./routes/googleAuth.js";
import sheetsRouter from "./routes/sheets.js";
import statsRouter from "./routes/stats.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;
app.use(helmet());
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({ message: "FBGroupScraper Pro Node.js Fallback API is running" });
});

import scriptsRouter from "./routes/scripts.js";
import systemConfigRouter from "./routes/systemConfig.js";

app.use("/api/auth", authRouter);
app.use("/api/auth/google", googleAuthRouter);
app.use("/api/config", systemConfigRouter);
app.use("/api/config/fb-accounts", configRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/jobs", exportsRouter);
app.use("/api/jobs", analyticsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/sheets", sheetsRouter);
app.use("/api/scripts", scriptsRouter);

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const match = pathname.match(/^\/api\/ws\/jobs\/([^/]+)$/);
  
  if (match) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, match[1]);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", async (ws, request, jobId) => {
  console.log(`WebSocket client subscribed to job progress: ${jobId}`);
  
  let job = await ScrapeJob.findById(jobId);
  let isExecution = false;
  if (!job) {
    job = await ScriptExecution.findById(jobId);
    isExecution = true;
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
});

const startServer = async () => {
  try {
    await initDatabase();
    server.listen(PORT, () => {
      console.log(`Node.js Fallback Backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start Node.js server database:", err);
  }
};

startServer();
