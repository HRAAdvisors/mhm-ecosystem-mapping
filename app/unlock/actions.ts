"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, accessToken, isCorrectPassword, safeNextPath } from "@/lib/access";

export type UnlockState = { error: string | null };

export async function unlock(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!isCorrectPassword(password)) {
    return { error: "That password is not correct." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, await accessToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(next);
}

export async function lock(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const cookieStore = await cookies();
  cookieStore.delete({ name: ACCESS_COOKIE, path: "/", secure: true, sameSite: "none" });
  redirect(`/unlock?next=${encodeURIComponent(next)}`);
}
