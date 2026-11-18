"use client";

import { useState } from "react";
import { resolveLogo } from "@/lib/logos";

function hue(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  return hash % 360;
}

export function TeamBadge({
  name,
  shortName,
  logoUrl,
  seed,
  worldRank,
  compact = false,
  align = "start",
}: {
  name: string;
  shortName: string;
  logoUrl?: string | null;
  seed?: number;
  worldRank?: number | null;
  compact?: boolean;
  align?: "start" | "end";
}) {
  const [broken, setBroken] = useState(false);
  const color = hue(name);
  const src = resolveLogo({ name, logoUrl });
  const size = compact ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-[11px]";
  const initials = shortName.slice(0, 3).toUpperCase();

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${align === "end" ? "flex-row-reverse text-right" : ""}`}>
      <span className={`relative grid ${size} shrink-0 place-items-center overflow-hidden rounded-xl bg-zinc-800 p-0.5 font-bold`} style={{ color: `hsl(${color} 85% 86%)` }}>
        {src && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
        ) : (
          initials
        )}
      </span>
      <span className="min-w-0">
        <span className={`block truncate font-semibold ${compact ? "text-sm" : "text-[15px]"}`}>{name}</span>
        {seed != null || worldRank != null ? (
          <span className="block text-[11px] text-zinc-500">
            {seed != null ? `Seed ${seed}` : ""}
            {seed != null && worldRank != null ? " · " : ""}
            {worldRank != null ? `VRS #${worldRank}` : ""}
          </span>
        ) : null}
      </span>
    </span>
  );
}
