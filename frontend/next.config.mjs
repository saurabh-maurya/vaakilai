/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // unsafe-eval removed; unsafe-inline kept for Next.js hydration scripts.
      // TODO: implement nonce-based CSP via Next.js middleware for full hardening.
      "script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://vakilai-documents.s3.ap-south-1.amazonaws.com https://ui-avatars.com",
      "font-src 'self'",
      // In production back-end URLs should be HTTPS — update NEXT_PUBLIC_* env vars accordingly
      `connect-src 'self' ${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"} ${process.env.NEXT_PUBLIC_AI_URL ?? "http://localhost:8001"}`,
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig = {
  images: {
    domains: ["vakilai-documents.s3.ap-south-1.amazonaws.com", "ui-avatars.com"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/v1/:path*`,
      },
      {
        source: "/api/ai/:path*",
        destination: `${process.env.NEXT_PUBLIC_AI_URL || "http://localhost:8001"}/ai/:path*`,
      },
    ];
  },
};

export default nextConfig;
