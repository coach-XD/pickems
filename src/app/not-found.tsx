import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-16">
      <h1 className="text-3xl font-semibold">That page isn&apos;t here</h1>
      <Link href="/" className="mt-6 text-sm font-semibold text-amber-300">
        Back to the board
      </Link>
    </main>
  );
}
