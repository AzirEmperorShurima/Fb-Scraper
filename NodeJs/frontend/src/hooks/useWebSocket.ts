import { useEffect, useRef } from "react";
import { API_URL } from "../utils/api";

interface WebSocketMessage {
  job_id: string;
  status: string;
  progress: number;
  error_message: string | null;
  completed_at: string | null;
  logs?: string;
}

export const useWebSocket = (
  jobId: string | null,
  onMessage: (data: WebSocketMessage) => void
) => {
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!jobId) return;

    // Convert http/https base url to ws/wss protocols
    const wsBaseUrl = API_URL.replace(/^http/, "ws");
    const wsUrl = `${wsBaseUrl}/api/ws/jobs/${jobId}`;

    console.log(`Connecting to progress WebSocket: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error("Failed to parse websocket message", error);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [jobId, onMessage]);

  return socketRef.current;
};
