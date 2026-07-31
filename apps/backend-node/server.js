import http from "http";
import { WebSocketServer } from "ws";
import { config } from "./config/env.js";
import { initDatabase } from "./database.js";
import app from "./app.js";
import { handleJobProgressWebSocket } from "./websockets/jobProgress.js";
import "./queue/scraperWorker.js"; // Initialize BullMQ workers

const server = http.createServer(app);
const PORT = config.PORT;

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

wss.on("connection", handleJobProgressWebSocket);

const startServer = async () => {
  try {
    await initDatabase();
    server.listen(PORT, () => {
      console.log(`Node.js Backend running in ${config.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start Node.js server database:", err);
  }
};

startServer();
