"use client";

import { usePathname } from "next/navigation";
import { lock } from "@/app/unlock/actions";
import { isLockedPath } from "@/lib/access";

export function LockButton() {
  const pathname = usePathname();

  if (!isLockedPath(pathname)) return null;

  return (
    <form action={lock} className="fixed bottom-6 right-6 z-50">
      <input type="hidden" name="next" value={pathname} />
      <button
        type="submit"
        className="flex items-center gap-2 rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        Lock
      </button>
    </form>
  );
}
