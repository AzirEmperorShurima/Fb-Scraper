import React, { useEffect, useRef } from "react";
import { cn } from "../utils/cn";

export interface ConsoleTerminalProps extends React.HTMLAttributes<HTMLDivElement> {
  logs: string[];
  status?: "idle" | "running" | "completed" | "failed";
}

export function ConsoleTerminal({ logs, status = "idle", className, ...props }: ConsoleTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      className={cn(
        "flex flex-col w-full h-[500px] rounded-lg overflow-hidden border border-slate-700 bg-[#0c0c0c] shadow-2xl",
        className
      )}
      {...props}
    >
      {/* Terminal Header */}
      <div className="flex h-10 items-center justify-between bg-slate-800/80 px-4 select-none">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-rose-500" />
          <div className="h-3 w-3 rounded-full bg-amber-500" />
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
        </div>
        <div className="text-xs font-medium text-slate-400 font-mono">
          fb-scraper-console {status === "running" ? "(running...)" : ""}
        </div>
        <div className="w-12" /> {/* Spacer */}
      </div>

      {/* Terminal Body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm text-green-400 scroll-smooth"
      >
        {logs.length === 0 ? (
          <div className="text-slate-500 italic">No logs yet. Press Run to start...</div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="whitespace-pre-wrap break-words">
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
