"use client";

import { useState } from "react";

export function SaveStatus({
  locked,
  pending,
  failed,
}: {
  locked: boolean;
  pending: boolean;
  failed: boolean;
}) {
  const label = locked ? "Locked" : pending ? "Saving…" : failed ? "Not saved" : "Saved";
  const tone = locked ? "text-zinc-500" : pending ? "text-amber-200" : failed ? "text-rose-300" : "text-emerald-300";
  return <span className={`text-[11px] font-semibold ${tone}`}>{label}</span>;
}

export function ResetControl({
  disabled,
  label = "Reset",
  onReset,
}: {
  disabled: boolean;
  label?: string;
  onReset: () => void;
}) {
  const [armed, setArmed] = useState(false);
  if (armed) {
    return (
      <span className="inline-flex items-center gap-1">
        <button type="button" onClick={() => { setArmed(false); onReset(); }} className="text-[11px] font-semibold text-rose-200">
          Confirm
        </button>
        <button type="button" onClick={() => setArmed(false)} className="text-[11px] font-semibold text-zinc-500">
          Cancel
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setArmed(true)}
      className="text-[11px] font-semibold text-zinc-400 disabled:opacity-40"
    >
      {label}
    </button>
  );
}
