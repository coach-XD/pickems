"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/session";
import { cx } from "@/lib/ui";

const links = [
  { href: "/", label: "Board", match: (path: string) => path === "/" },
  { href: "/picks", label: "Picks", match: (path: string) => path.startsWith("/picks") },
  { href: "/stages", label: "Swiss", match: (path: string) => path.startsWith("/stages") },
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
  const width = wide ? "max-w-[1440px]" : "max-w-3xl";
  return (
    <div className="min-h-full">
      <header className={`mx-auto flex w-full items-center justify-between gap-3 px-4 pt-4 ${width}`}>
        <Link href="/" className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/90">Singapore 2026</p>
          <p className="truncate text-lg font-semibold tracking-tight">Major Pick&apos;em</p>
        </Link>
        <div className="flex items-center gap-2">
          <span className="max-w-28 truncate rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">{name}</span>
          <form action={signOut}>
            <button type="submit" className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-200 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className={`mx-auto w-full px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 ${width}`}>{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-zinc-950/90 backdrop-blur">
        <div className={`mx-auto grid grid-cols-3 pb-[env(safe-area-inset-bottom)] ${width}`}>
          {links.map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cx(
                  "flex h-14 items-center justify-center text-sm font-semibold",
                  active ? "text-amber-300" : "text-zinc-500",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
