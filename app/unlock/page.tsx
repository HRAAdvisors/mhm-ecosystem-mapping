import type { Metadata } from "next";
import Link from "next/link";
import { UnlockForm } from "@/components/UnlockForm";
import { safeNextPath } from "@/lib/access";

export const metadata: Metadata = {
  title: "Password required | MHM",
  robots: { index: false },
};

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex h-full flex-1 items-center justify-center overflow-y-auto bg-gray-50 px-4 py-16">
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Password required</h1>
        <p className="mt-2 mb-6 text-sm leading-relaxed text-muted-foreground">
          Enter the password to view this page.
        </p>
        <UnlockForm next={safeNextPath(next)} />
        <Link
          href="/regions/A"
          className="mt-6 block text-center text-sm text-[var(--cobalt)] hover:underline"
        >
          Back to Ecosystem
        </Link>
      </div>
    </main>
  );
}
