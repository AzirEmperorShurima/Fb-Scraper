import React from "react";
import { cn } from "../../utils/cn";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200 dark:bg-slate-800 motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
