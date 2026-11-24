"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/session";
import { LiveRefresh } from "@/components/LiveRefresh";
import { cx } from "@/lib/ui";

const links = [
  { href: "/", label: "Board", match: (path: string) => path === "/" },
  { href: "/picks", label: "Picks", match: (path: string) => path.startsWith("/picks") },
  { href: "/players", label: "Players", match: (path: string) => path.startsWith("/players") },
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
  const wide = pathname.startsWith("/picks") || pathname.startsWith("/players/") || pathname.includes("/compare");
  const width = wide ? "max-w-[1920px]" : "max-w-3xl";
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/90 backdrop-blur">
        <div className={`mx-auto flex w-full flex-nowrap items-center gap-2 px-3 py-1.5 ${width}`}>
          <Link href="/" className="min-w-0 shrink-0">
            <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/90 sm:block">Singapore 2026</p>
            <p className="truncate text-sm font-semibold tracking-tight">Pick&apos;em</p>
          </Link>
          <nav className="flex shrink-0 items-center gap-1">
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
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <LiveRefresh />
            <span className="hidden max-w-28 truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 sm:inline">{name}</span>
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
