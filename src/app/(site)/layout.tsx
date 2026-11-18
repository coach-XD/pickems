import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSessionPlayer } from "@/lib/auth";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  return <AppShell name={player.displayName}>{children}</AppShell>;
}
