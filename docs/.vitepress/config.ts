import { defineConfig } from "vitepress";
import type { HeadConfig } from "vitepress";

const CANONICAL_BASE = "https://bunway.jointops.dev/";

function createCanonicalUrl(relativePath?: string): string {
  const base = CANONICAL_BASE.endsWith("/") ? CANONICAL_BASE : `${CANONICAL_BASE}/`;
  if (!relativePath) return base;
  let normalized = relativePath.replace(/\\/g, "/");
  normalized = normalized.replace(/(^|\/)index\.md$/, "$1");
  if (normalized && normalized.endsWith(".md")) {
    normalized = normalized.replace(/\.md$/, ".html");
  }
  return new URL(normalized, base).toString();
}

export default defineConfig({
  base: "/",
  title: "bunWay - Express API. Bun speed.",
  description: "Express-compatible web framework for Bun. Drop-in replacement with zero rewrites. Same API, faster runtime.",
  appearance: true,
  cleanUrls: false,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    ["meta", { name: "theme-color", content: "#3fc5b7" }],
    ["meta", { name: "description", content: "Express-compatible web framework for Bun. Drop-in replacement with zero rewrites. Same API, faster runtime." }],
    ["meta", { name: "keywords", content: "bun, express, web framework, javascript, typescript, nodejs, http server, routing, middleware" }],
    ["meta", { name: "author", content: "JointOps" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "bunWay" }],
    ["meta", { property: "og:title", content: "bunWay - Express API. Bun speed." }],
    ["meta", { property: "og:description", content: "Express-compatible web framework for Bun. Drop-in replacement with zero rewrites." }],
    ["meta", { property: "og:url", content: "https://bunway.jointops.dev" }],
    ["meta", { property: "og:image", content: "https://bunway.jointops.dev/og-image.png" }],
    ["meta", { property: "og:image:width", content: "1200" }],
    ["meta", { property: "og:image:height", content: "630" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:site", content: "@JointOps_" }],
    ["meta", { name: "twitter:title", content: "bunWay - Express API. Bun speed." }],
    ["meta", { name: "twitter:description", content: "Express-compatible web framework for Bun. Drop-in replacement with zero rewrites." }],
    ["meta", { name: "twitter:image", content: "https://bunway.jointops.dev/og-image.png" }],
    ["meta", { name: "google-site-verification", content: "MfUtITfQjC9X52HpWU_55nMEkiQTpunoH2pMPqg6unM" }],
    ["script", { type: "application/ld+json" }, JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      "name": "bunWay",
      "description": "Express-compatible web framework for Bun. Drop-in replacement with zero rewrites.",
      "url": "https://bunway.jointops.dev",
      "codeRepository": "https://github.com/JointOps/bunway",
      "programmingLanguage": ["TypeScript", "JavaScript"],
      "runtimePlatform": "Bun",
      "license": "https://opensource.org/licenses/MIT",
      "author": {
        "@type": "Organization",
        "name": "JointOps",
        "url": "https://jointops.dev"
      },
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    })],
  ],
  sitemap: {
    hostname: CANONICAL_BASE,
  },
  transformHead({ pageData }) {
    const canonical = createCanonicalUrl(pageData.relativePath);
    const head: HeadConfig[] = [["link", { rel: "canonical", href: canonical }]];
    if (pageData.description) {
      head.push(["meta", { name: "description", content: pageData.description }]);
      head.push(["meta", { property: "og:description", content: pageData.description }]);
    }
    return head;
  },
  themeConfig: {
    nav: [{ text: "API Reference", link: "https://bunway.jointops.dev/api/index.html" }],
    outline: [2, 3],
    docFooter: {
      prev: "Previous",
      next: "Next",
    },
    sidebar: [
      {
        text: "🧭 Essentials",
        items: [
          { text: "Overview", link: "/guide/overview" },
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Coming from Express", link: "/guide/express-migration" },
          { text: "Core Primitives", link: "/guide/core-primitives" },
          { text: "Router", link: "/guide/router" },
          { text: "WebSockets", link: "/guide/websockets" },
        ],
      },
      {
        text: "🧩 Middleware",
        items: [
          { text: "Overview", link: "/middleware/index" },
          { text: "Body Parsing", link: "/middleware/body-parsing" },
          { text: "CORS", link: "/middleware/cors" },
          { text: "Session", link: "/middleware/session" },
          { text: "Authentication", link: "/middleware/auth" },
          { text: "Logger", link: "/middleware/logger" },
          { text: "Security", link: "/middleware/security" },
          { text: "Rate Limiting", link: "/middleware/rate-limit" },
          { text: "Static Files", link: "/middleware/static" },
          { text: "Cookies", link: "/middleware/cookies" },
          { text: "Error Handling", link: "/middleware/error-handler" },
        ],
      },
      {
        text: "🤝 Community",
        items: [{ text: "Roadmap & Contributions", link: "/community/build-together" }],
      },
      {
        text: "📚 Reference",
        items: [{ text: "API Reference", link: "/api/index.html" }],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/JointOps/bunway" },
      { icon: "npm", link: "https://www.npmjs.com/package/bunway" }
    ],
  },
});
