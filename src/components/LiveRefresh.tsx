"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 20_000;

/**
 * Refreshes server data. Client pick state lives in useState and is not reset
 * when the server payload arrives, so an unsaved click stays on screen.
 */
export function LiveRefresh() {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [ago, setAgo] = useState(0);

  useEffect(() => {
    const refresh = () => {
      router.refresh();
      setUpdatedAt(Date.now());
    };
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = window.setInterval(tick, INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  useEffect(() => {
    const clock = window.setInterval(() => setAgo(Math.max(0, Math.round((Date.now() - updatedAt) / 1000))), 1000);
    return () => window.clearInterval(clock);
  }, [updatedAt]);

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500" title="This page refreshes about every 20 seconds">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Live · {ago}s ago
    </span>
  );
}
