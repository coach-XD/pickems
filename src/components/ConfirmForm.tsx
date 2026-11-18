"use client";

import type { ReactNode } from "react";

export function ConfirmForm({
  message,
  action,
  children,
  className,
}: {
  message: string;
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
