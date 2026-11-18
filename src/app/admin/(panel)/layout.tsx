import Link from "next/link";
import { redirect } from "next/navigation";
import { adminLogout } from "@/app/actions/session";
import { isAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <div className="min-h-full">
      <header className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">Admin</p>
            <p className="font-semibold">Pick&apos;em desk</p>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/admin" className="text-zinc-300">
              Stages
            </Link>
            <Link href="/admin/players" className="text-zinc-300">
              Players
            </Link>
            <Link href="/admin/rosters" className="text-zinc-300">
              Rosters
            </Link>
            <Link href="/" className="text-zinc-300">
              Board
            </Link>
            <form action={adminLogout}>
              <button type="submit" className="text-zinc-500">
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-5">{children}</main>
    </div>
  );
}
