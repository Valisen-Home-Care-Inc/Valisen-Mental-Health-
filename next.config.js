/** @type {import('next').NextConfig} */
const developmentCsp = process.env.NODE_ENV === "development";
const privateRouteCsp =
  `default-src 'self'; base-uri 'self'; connect-src 'self'${developmentCsp ? " ws:" : ""}; ` +
  "font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; " +
  "img-src 'self' data:; object-src 'none'; " +
  `script-src 'self' 'unsafe-inline'${developmentCsp ? " 'unsafe-eval'" : ""}; ` +
  "style-src 'self' 'unsafe-inline'";
const adminLoginCsp =
  `default-src 'self'; base-uri 'self'; connect-src 'self' https://challenges.cloudflare.com${developmentCsp ? " ws:" : ""}; ` +
  "font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; frame-src https://challenges.cloudflare.com; " +
  "img-src 'self' data: https://challenges.cloudflare.com; object-src 'none'; " +
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${developmentCsp ? " 'unsafe-eval'" : ""}; ` +
  "style-src 'self' 'unsafe-inline'";

const nextConfig = {
  agentRules: false,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      // Next applies every matching rule in order. Put the baseline first so
      // the tighter route policies below remain authoritative.
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value:
              "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
          },
        ],
      },
      {
        source: "/c/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          {
            key: "Content-Security-Policy",
            value: privateRouteCsp,
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          {
            key: "Content-Security-Policy",
            value: privateRouteCsp,
          },
        ],
      },
      {
        // The login is the only private route that embeds Cloudflare's
        // challenge. Dashboard/data routes keep the stricter policy above.
        source: "/admin/login",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          {
            key: "Content-Security-Policy",
            value: adminLoginCsp,
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

module.exports = nextConfig;
