export const ACCESS_COOKIE = "mhm_access";
export const LOCKED_PATHS = ["/home", "/data", "/methodology"];

const ACCESS_PASSWORD = process.env.SITE_PASSWORD ?? "MHM2026";

export function isLockedPath(pathname: string) {
  return LOCKED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function safeNextPath(next: string | null | undefined) {
  return next && isLockedPath(next) ? next : "/home";
}

export async function accessToken() {
  const bytes = new TextEncoder().encode(`mhm-site:${ACCESS_PASSWORD}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isCorrectPassword(password: string) {
  return password === ACCESS_PASSWORD;
}
