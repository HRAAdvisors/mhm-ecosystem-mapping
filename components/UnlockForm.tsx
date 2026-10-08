"use client";

import { useActionState } from "react";
import { unlock, type UnlockState } from "@/app/unlock/actions";

const initialState: UnlockState = { error: null };

export function UnlockForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(unlock, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password" className="text-sm font-medium text-foreground">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "password-error" : undefined}
        className="rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground outline-none focus:border-[var(--cobalt)] focus:ring-2 focus:ring-[var(--cobalt)]/20"
      />
      {state.error && (
        <p id="password-error" role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--cobalt)] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#2E3DB8] disabled:opacity-60"
      >
        {pending ? "Checking..." : "Unlock"}
      </button>
    </form>
  );
}
