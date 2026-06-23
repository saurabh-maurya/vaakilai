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

  // ── API5: Nonce-based Content-Security-Policy ──────────────────────────────
  // Per-request nonce replaces 'unsafe-inline' for scripts.
  // 'strict-dynamic' propagates trust to scripts loaded by nonce-verified scripts
  // (Next.js chunk loading), so individual bundles do not each need a nonce.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
  const aiUrl = process.env.NEXT_PUBLIC_AI_URL ?? "http://localhost:8001";

  const csp = [
    "default-src 'self'",
    // Nonce + strict-dynamic: no unsafe-inline, no unsafe-eval for scripts
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Tailwind / CSS-in-JS still requires unsafe-inline for styles
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${backendUrl} ${aiUrl}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  // Forward nonce to the app via request header (readable by layout.tsx via headers())
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Set CSP on the response — this is what the browser enforces
  response.headers.set("Content-Security-Policy", csp);

  return response;
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
