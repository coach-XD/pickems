"use client";

import { useSyncExternalStore } from "react";

function utcLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return (
    new Intl.DateTimeFormat("en-GB", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hourCycle: "h23",
    }).format(date) + " UTC"
  );
}

function localLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const label = useSyncExternalStore(
    () => () => {},
    () => localLabel(iso),
    () => utcLabel(iso),
  );
  return (
    <time dateTime={iso} title={iso} className={className}>
      {label}
    </time>
  );
}
