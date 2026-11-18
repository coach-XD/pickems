"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/session";
import { cx } from "@/lib/ui";

const links = [
  { href: "/", label: "Board", match: (path: string) => path === "/" },
  { href: "/picks", label: "Picks", match: (path: string) => path.startsWith("/picks") },
  { href: "/stages", label: "Stages", match: (path: string) => path.startsWith("/stages") },
];

export function AppShell({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const wide = pathname.startsWith("/picks");
  const width = wide ? "max-w-[1800px]" : "max-w-3xl";
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/90 backdrop-blur">
        <div className={`mx-auto flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 ${width}`}>
          <Link href="/" className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/90">Singapore 2026</p>
            <p className="truncate text-sm font-semibold tracking-tight">Major Pick&apos;em</p>
          </Link>
          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const active = link.match(pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cx(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    active ? "bg-amber-400 text-zinc-950" : "text-zinc-400 hover:text-zinc-100",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="max-w-28 truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">{name}</span>
            <form action={signOut}>
              <button type="submit" className="text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-200 hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className={`mx-auto w-full px-3 py-3 ${width}`}>{children}</main>
    </div>
  );
}
