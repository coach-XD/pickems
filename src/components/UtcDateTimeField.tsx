"use client";

import { useState } from "react";
import { inputClass } from "@/lib/ui";

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function UtcDateTimeField({
  name,
  defaultIso,
  required,
}: {
  name: string;
  defaultIso?: string;
  required?: boolean;
}) {
  const [iso, setIso] = useState(defaultIso ?? "");
  return (
    <div>
      <input
        key={defaultIso ?? "empty"}
        type="datetime-local"
        required={required}
        defaultValue={defaultIso ? toLocalInput(defaultIso) : ""}
        className={inputClass}
        onChange={(event) => {
          const value = event.target.value;
          setIso(value ? new Date(value).toISOString() : "");
        }}
      />
      <input type="hidden" name={name} value={iso} />
      <p className="mt-1 text-[11px] text-zinc-500">{iso ? `Stored as ${iso.replace(".000Z", "Z")}` : "Shown in your timezone, stored as UTC."}</p>
    </div>
  );
}
