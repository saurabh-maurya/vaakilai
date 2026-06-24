import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require an authenticated session cookie
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/chat",
  "/documents",
  "/rights",
  "/lawyers",
  "/pro",
  "/settings",
  "/consultation",
  "/cases",
  "/ecourts",
  "/odr",
  "/news",
  "/ipc-bns",
  "/compliance",
  "/compliance-filings",
  "/company-compliance",
  "/client",
  "/admin",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Z5: Edge-level auth guard ──────────────────────────────────────────────
  // The httpOnly cookie presence is a fast, zero-latency check at the CDN edge.
  // Server-side API routes enforce full JWT validation independently.
  if (isProtected(pathname) && !request.cookies.get("vk_session")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      // Apply to all routes except static assets
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
