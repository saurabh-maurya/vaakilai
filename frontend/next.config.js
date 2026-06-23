/** @type {import('next').NextConfig} */

// Non-CSP security headers — CSP is handled per-request by src/middleware.ts
// (nonce-based, so it cannot be static here)
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  images: {
    // DEP1 mitigation: explicitly deny all remote image patterns.
    // This blocks the Next.js Image Optimizer DoS vector (CVE via remotePatterns).
    remotePatterns: [],
  },
};

module.exports = nextConfig;
