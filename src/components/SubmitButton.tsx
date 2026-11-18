"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cx } from "@/lib/ui";

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className,
  disabled,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={cx(className)} disabled={disabled || pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
