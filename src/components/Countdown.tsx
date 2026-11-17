"use client";

import { useEffect, useState } from "react";

function remaining(lockIso: string, now: number): string {
  const diff = new Date(lockIso).getTime() - now;
  if (diff <= 0) return "Locked";
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `Locks in ${days}d ${hours}h`;
  if (hours > 0) return `Locks in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Locks in ${minutes}m ${seconds}s`;
  return `Locks in ${seconds}s`;
}

export function Countdown({ lockIso }: { lockIso: string }) {
  const [label, setLabel] = useState("Checking lock…");

  useEffect(() => {
    const tick = () => setLabel(remaining(lockIso, Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lockIso]);

  const locked = label === "Locked";
  return <span className={locked ? "text-rose-300" : "text-amber-200"}>{label}</span>;
}
