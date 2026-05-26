// docs/.vitepress/config.ts — full replacement
import { defineConfig } from "vitepress";
import type { HeadConfig } from "vitepress";

const CANONICAL_BASE = "https://bunway.jointops.dev/";
const SITE_TITLE = "bunWay";
const SITE_DESCRIPTION =
  "Express-compatible web framework for Bun. Drop-in Express replacement with zero rewrites, zero dependencies, and 24 built-in middleware. Same (req, res, next) API, 3–4× faster.";

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
  title: SITE_TITLE,
  titleTemplate: ":title | bunWay",
  description: SITE_DESCRIPTION,
  appearance: "dark",
  cleanUrls: false,
  lastUpdated: true,
  head: [
    /* ── Fonts ────────────────────────────────────────────────── */
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    ["link", {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap",
    }],
    /* ── Meta ─────────────────────────────────────────────────── */
    ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    ["meta", { name: "theme-color", content: "#3fc5b7" }],
    ["meta", { name: "keywords", content: "bunway, bun framework, bun express, express alternative, bun web framework, bun http server, express compatible bun, bun routing, bun middleware, typescript web framework, bun server, express to bun migration, bun rest api" }],
    ["meta", { name: "author", content: "JointOps" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:locale", content: "en_US" }],
    ["meta", { property: "og:site_name", content: "bunWay" }],
    ["meta", { property: "og:image", content: "https://bunway.jointops.dev/og-image.png" }],
    ["meta", { property: "og:image:width", content: "1200" }],
    ["meta", { property: "og:image:height", content: "630" }],
    ["meta", { property: "og:image:alt", content: "bunWay — Express API. Bun speed. Zero dependencies." }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:site", content: "@JointOps_" }],
    ["meta", { name: "twitter:image", content: "https://bunway.jointops.dev/og-image.png" }],
    ["meta", { name: "google-site-verification", content: "MfUtITfQjC9X52HpWU_55nMEkiQTpunoH2pMPqg6unM" }],
    ["script", { type: "application/ld+json" }, JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      "name": "bunWay",
      "alternateName": "bunway",
      "description": SITE_DESCRIPTION,
      "url": "https://bunway.jointops.dev",
      "codeRepository": "https://github.com/JointOps/bunway",
      "programmingLanguage": ["TypeScript", "JavaScript"],
      "runtimePlatform": "Bun",
      "applicationCategory": "Web Framework",
      "operatingSystem": "Cross-platform",
      "license": "https://opensource.org/licenses/MIT",
      "author": { "@type": "Organization", "name": "JointOps", "url": "https://jointops.dev" },
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    })],
    ["script", { type: "application/ld+json" }, JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "bunWay Documentation",
      "alternateName": "bunway docs",
      "url": "https://bunway.jointops.dev",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://bunway.jointops.dev/?search={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    })],
  ],
  sitemap: { hostname: CANONICAL_BASE },
  transformHead({ pageData }) {
    const canonical = createCanonicalUrl(pageData.relativePath);
    const head: HeadConfig[] = [["link", { rel: "canonical", href: canonical }]];
    const pageTitle = pageData.title
      ? `${pageData.title} | bunWay`
      : "bunWay — Express-compatible web framework for Bun";
    const pageDescription = pageData.description || SITE_DESCRIPTION;
    const pageUrl = canonical;
    head.push(["meta", { name: "description", content: pageDescription }]);
    head.push(["meta", { property: "og:title", content: pageTitle }]);
    head.push(["meta", { property: "og:description", content: pageDescription }]);
    head.push(["meta", { property: "og:url", content: pageUrl }]);
    head.push(["meta", { name: "twitter:title", content: pageTitle }]);
    head.push(["meta", { name: "twitter:description", content: pageDescription }]);
    return head;
  },
  themeConfig: {
    nav: [
      { text: "Docs",       link: "/guide/overview" },
      { text: "Middleware", link: "/middleware/index" },
      { text: "Changelog",  link: "/community/build-together" },
      { text: "API",        link: "https://bunway.jointops.dev/api/index.html" },
    ],
    outline: [2, 3],
    docFooter: { prev: "Previous", next: "Next" },
    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "Overview",              link: "/guide/overview" },
          { text: "Getting Started",       link: "/guide/getting-started" },
          { text: "Migrating from Express",link: "/guide/express-migration" },
        ],
      },
      {
        text: "Core",
        items: [
          { text: "Primitives",        link: "/guide/core-primitives" },
          { text: "Router",            link: "/guide/router" },
          { text: "Server Lifecycle",  link: "/guide/server-lifecycle" },
          { text: "Request & Response",link: "/guide/request-response" },
          { text: "WebSockets",        link: "/guide/websockets" },
        ],
      },
      {
        text: "Middleware",
        items: [
          { text: "Overview", link: "/middleware/index" },
          {
            text: "Parsing",
            collapsed: true,
            items: [
              { text: "Body Parsing",  link: "/middleware/body-parsing" },
              { text: "Cookies",       link: "/middleware/cookies" },
              { text: "File Uploads",  link: "/middleware/file-uploads" },
            ],
          },
          {
            text: "Security",
            collapsed: true,
            items: [
              { text: "Authentication", link: "/middleware/auth" },
              { text: "CORS",           link: "/middleware/cors" },
              { text: "Security",       link: "/middleware/security" },
              { text: "Rate Limiting",  link: "/middleware/rate-limit" },
              { text: "Session",        link: "/middleware/session" },
              { text: "HPP Protection", link: "/guide/middleware/hpp" },
            ],
          },
          {
            text: "Monitoring",
            collapsed: true,
            items: [
              { text: "Logger",        link: "/middleware/logger" },
              { text: "Request ID",    link: "/middleware/request-id" },
              { text: "Response Time", link: "/middleware/response-time" },
            ],
          },
          {
            text: "Processing",
            collapsed: true,
            items: [
              { text: "Timeout",         link: "/guide/middleware/timeout" },
              { text: "Validation",      link: "/guide/middleware/validation" },
              { text: "Method Override", link: "/middleware/method-override" },
              { text: "Error Handling",  link: "/middleware/error-handler" },
            ],
          },
          {
            text: "Serving",
            collapsed: true,
            items: [
              { text: "Static Files", link: "/middleware/static" },
              { text: "Compression",  link: "/middleware/compression" },
              { text: "Favicon",      link: "/middleware/favicon" },
              { text: "SSE",          link: "/middleware/sse" },
            ],
          },
        ],
      },
      {
        text: "Community",
        items: [
          { text: "Roadmap", link: "/community/build-together" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "API Reference", link: "https://bunway.jointops.dev/api/index.html" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github",  link: "https://github.com/JointOps/bunway" },
      { icon: "npm",     link: "https://www.npmjs.com/package/bunway" },
      { icon: "discord", link: "https://discord.gg/fTF4qjaMFT" },
    ],
  },
  markdown: {
    theme: "github-dark-dimmed",
    lineNumbers: false,
  },
});
