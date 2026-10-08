import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken, isLockedPath } from "@/lib/access";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/regions/A", request.url));
  }

  if (isLockedPath(pathname)) {
    const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
    if (cookie !== (await accessToken())) {
      const unlockUrl = new URL("/unlock", request.url);
      unlockUrl.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(unlockUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/home/:path*", "/data/:path*", "/methodology/:path*"],
};
