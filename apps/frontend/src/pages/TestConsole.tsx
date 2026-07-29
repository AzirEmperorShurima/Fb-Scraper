import React, { useState, useCallback } from "react";
import { Terminal, Play, Square, Loader2 } from "lucide-react";
import api from "../utils/api";
import { useWebSocket } from "../hooks/useWebSocket";
import { ConsoleTerminal } from "../components/ConsoleTerminal";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";

export const TestConsole: React.FC = () => {
  const [groupUrl, setGroupUrl] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultCount, setResultCount] = useState<number | null>(null);

  const handleWebSocketMessage = useCallback((data: any) => {
    if (data.status) {
      if (["completed", "failed", "stopped"].includes(data.status)) {
        setStatus(data.status === "stopped" ? "failed" : data.status as any);
      } else {
        setStatus("running");
      }
    }
    
    if (data.logs) {
      const newLogs = data.logs.split("\n").filter((l: string) => l.trim() !== "");
      setLogs((prev) => {
        // Prevent duplicate logs (simplistic check for this test console)
        const combined = [...prev, ...newLogs];
        return Array.from(new Set(combined));
      });
    }

    if (data.status === "completed" && activeJobId) {
      // Fetch posts count
      api.get(`/api/jobs/${activeJobId}/posts`).then((res) => {
        setResultCount(res.data.total);
      }).catch(console.error);
    }
  }, [activeJobId]);

  useWebSocket(activeJobId, handleWebSocketMessage);

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupUrl) return;

    setIsSubmitting(true);
    setLogs([]);
    setStatus("idle");
    setResultCount(null);
    setActiveJobId(null);

    try {
      const res = await api.post("/api/jobs", {
        group_url: groupUrl,
        max_posts: 5,
        include_comments: false,
      });
      setActiveJobId(res.data._id);
      setStatus("running");
    } catch (err) {
      console.error(err);
      setLogs((prev) => [...prev, "❌ Failed to start job. Check console."]);
      setStatus("failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStopTest = async () => {
    if (!activeJobId) return;
    try {
      await api.post(`/api/jobs/${activeJobId}/stop`);
      setStatus("failed");
      setLogs((prev) => [...prev, "⚠️ Test run stopped by user."]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Test Console</h1>
        <p className="text-muted-foreground mt-2">
          Run a quick diagnostic scrape (max 5 posts) to verify profile connections and watch real-time logs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            Diagnostic Runner
          </CardTitle>
          <CardDescription>Enter a Facebook Group URL to start a test scrape in the background.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRunTest} className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Target Group URL</label>
              <Input
                placeholder="https://facebook.com/groups/..."
                value={groupUrl}
                onChange={(e) => setGroupUrl(e.target.value)}
                disabled={status === "running" || isSubmitting}
                required
              />
            </div>
            {status === "running" ? (
              <Button type="button" variant="destructive" onClick={handleStopTest} className="w-32">
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting || !groupUrl} className="w-32">
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Run Test
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <ConsoleTerminal logs={logs} status={status} />

      {resultCount !== null && (
        <Card className="border-success/50 bg-success/10">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-success">Test Completed Successfully!</h3>
              <p className="text-sm text-success/80">
                The scraper successfully fetched {resultCount} posts from the group.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
