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
  compact = false,
  align = "start",
}: {
  name: string;
  shortName: string;
  logoUrl?: string | null;
  seed?: number;
  compact?: boolean;
  align?: "start" | "end";
}) {
  const [broken, setBroken] = useState(false);
  const color = hue(name);
  const src = resolveLogo({ name, logoUrl });
  const size = compact ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-[11px]";
  const initials = shortName.slice(0, 3).toUpperCase();

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${align === "end" ? "flex-row-reverse text-right" : ""}`}>
      <span className={`relative grid ${size} shrink-0 place-items-center overflow-hidden rounded-lg font-bold`} style={{ background: `hsl(${color} 42% 24%)`, color: `hsl(${color} 85% 86%)` }}>
        {src && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-contain p-0.5" onError={() => setBroken(true)} />
        ) : (
          initials
        )}
      </span>
      <span className="min-w-0">
        <span className={`block truncate font-semibold ${compact ? "text-sm" : "text-[15px]"}`}>{name}</span>
        {seed != null ? <span className="block text-[11px] text-zinc-500">Seed {seed}</span> : null}
      </span>
    </span>
  );
}
