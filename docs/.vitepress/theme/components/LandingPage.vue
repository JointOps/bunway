<script setup lang="ts">
import { ref, onMounted } from 'vue'
import HeroSection from './HeroSection.vue'
import { useScrollReveal } from '../composables/useScrollReveal'

const activeCategory = ref('security')
const installCopied = ref(false)
const revealTargets = ref<HTMLElement[]>([])

onMounted(() => {
  revealTargets.value = [
    ...document.querySelectorAll<HTMLElement>('.reveal-up, .reveal-stagger'),
  ]
})

useScrollReveal(revealTargets)

const copyInstall = async () => {
  await navigator.clipboard.writeText('bun add bunway')
  installCopied.value = true
  setTimeout(() => { installCopied.value = false }, 2000)
}

const featureCategories = [
  {
    id: 'body',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
    name: 'Body Parsing',
    replaces: 'body-parser · express.json',
    code: `<span class="kw">import</span> { bunway, json, urlencoded, text, raw } <span class="kw">from</span> <span class="str">'bunway'</span>

<span class="kw">const</span> app = <span class="fn">bunway</span>()

app.<span class="fn">use</span>(<span class="fn">json</span>({ limit: <span class="str">'10mb'</span> }))         <span class="comment">// application/json</span>
app.<span class="fn">use</span>(<span class="fn">urlencoded</span>({ extended: <span class="kw">true</span> }))   <span class="comment">// HTML forms</span>
app.<span class="fn">use</span>(<span class="fn">text</span>())                             <span class="comment">// text/plain</span>
app.<span class="fn">use</span>(<span class="fn">raw</span>({                               <span class="comment">// binary + webhooks</span>
  verify: (req, buf) => <span class="fn">verifyWebhook</span>(buf)
}))`
  },
  {
    id: 'security',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    name: 'Security',
    replaces: 'helmet · csurf · express-rate-limit · hpp',
    code: `<span class="kw">import</span> { bunway, helmet, cors, csrf, rateLimit, hpp } <span class="kw">from</span> <span class="str">'bunway'</span>

<span class="kw">const</span> app = <span class="fn">bunway</span>()

app.<span class="fn">use</span>(<span class="fn">helmet</span>())                           <span class="comment">// 14 security headers</span>
app.<span class="fn">use</span>(<span class="fn">cors</span>({ origin: <span class="str">/\\.myapp\\.com$/</span> }))  <span class="comment">// CORS + preflight</span>
app.<span class="fn">use</span>(<span class="fn">rateLimit</span>({ windowMs: <span class="num">60_000</span>, max: <span class="num">100</span> }))
app.<span class="fn">use</span>(<span class="fn">csrf</span>())                             <span class="comment">// double-submit cookie</span>
app.<span class="fn">use</span>(<span class="fn">hpp</span>({ whitelist: [<span class="str">'tags'</span>] }))      <span class="comment">// parameter pollution</span>`
  },
  {
    id: 'sessions',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
    name: 'Sessions & Auth',
    replaces: 'express-session · passport · cookie-parser',
    code: `<span class="kw">import</span> { bunway, session, passport, cookieParser } <span class="kw">from</span> <span class="str">'bunway'</span>

<span class="kw">const</span> app = <span class="fn">bunway</span>()

app.<span class="fn">use</span>(<span class="fn">cookieParser</span>(<span class="str">'your-secret'</span>))
app.<span class="fn">use</span>(<span class="fn">session</span>({
  secret: <span class="str">'keyboard cat'</span>,
  name:   <span class="str">'sid'</span>,
  cookie: { maxAge: <span class="num">86400_000</span>, secure: <span class="kw">true</span> }
}))
app.<span class="fn">use</span>(<span class="fn">passport</span>())                           <span class="comment">// strategy-based auth</span>`
  },
  {
    id: 'files',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2H5z"/><path d="M9 3v18M15 3v18"/></svg>`,
    name: 'Files & Static',
    replaces: 'express.static · multer · serve-favicon',
    code: `<span class="kw">import</span> { bunway, upload, serveStatic, favicon } <span class="kw">from</span> <span class="str">'bunway'</span>

<span class="kw">const</span> app   = <span class="fn">bunway</span>()
<span class="kw">const</span> store = <span class="fn">upload</span>()

app.<span class="fn">use</span>(<span class="fn">favicon</span>(<span class="str">'./public/favicon.ico'</span>))
app.<span class="fn">use</span>(<span class="str">'/static'</span>, <span class="fn">serveStatic</span>(<span class="str">'./public'</span>))  <span class="comment">// ETag + 304 caching</span>
app.<span class="fn">post</span>(<span class="str">'/upload'</span>, store.<span class="fn">single</span>(<span class="str">'photo'</span>), (req, res) => {
  res.<span class="fn">json</span>({ name: req.file?.originalname })
})`
  },
  {
    id: 'observability',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    name: 'Observability',
    replaces: 'morgan · response-time · express-request-id',
    code: `<span class="kw">import</span> { bunway, logger, responseTime, requestId, sse } <span class="kw">from</span> <span class="str">'bunway'</span>

<span class="kw">const</span> app = <span class="fn">bunway</span>()

app.<span class="fn">use</span>(<span class="fn">requestId</span>())                <span class="comment">// X-Request-Id per request</span>
app.<span class="fn">use</span>(<span class="fn">responseTime</span>())             <span class="comment">// X-Response-Time header</span>
app.<span class="fn">use</span>(<span class="fn">logger</span>(<span class="str">'dev'</span>))              <span class="comment">// colorized request logs</span>

app.<span class="fn">get</span>(<span class="str">'/events'</span>, <span class="fn">sse</span>(), (req, res) => {
  res.<span class="fn">sendEvent</span>(<span class="str">'update'</span>, { ts: <span class="fn">Date.now</span>() })
})`
  },
  {
    id: 'utilities',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>`,
    name: 'Utilities',
    replaces: 'compression · connect-timeout · express-validator · method-override',
    code: `<span class="kw">import</span> { bunway, compression, timeout, validate, methodOverride } <span class="kw">from</span> <span class="str">'bunway'</span>

<span class="kw">const</span> app = <span class="fn">bunway</span>()

app.<span class="fn">use</span>(<span class="fn">compression</span>())       <span class="comment">// Brotli > gzip > deflate</span>
app.<span class="fn">use</span>(<span class="fn">timeout</span>(<span class="num">5000</span>))        <span class="comment">// 5s request timeout</span>
app.<span class="fn">use</span>(<span class="fn">methodOverride</span>())

app.<span class="fn">post</span>(<span class="str">'/contact'</span>, <span class="fn">validate</span>({
  body: {
    email: { required: <span class="kw">true</span>, type: <span class="str">'email'</span> },
    name:  { required: <span class="kw">true</span>, minLength: <span class="num">2</span> }
  }
}), handleContact)`
  }
]
</script>

<template>
  <div class="landing">

    <!-- Hero -->
    <HeroSection />

    <!-- ── Section 2: Interactive Feature Explorer ──────────── -->
    <section class="section explorer-section">
      <div class="section-inner reveal-up">
        <p class="section-eyebrow">What's inside</p>
        <h2 class="section-title">Everything included.<br>Nothing to install.</h2>
        <p class="section-subtitle">
          Every package Express developers reach for — already inside bunWay.
          No npm install. No version conflicts. No supply chain risk.
        </p>

        <div class="explorer">
          <!-- Category tabs -->
          <div class="explorer-tabs">
            <button
              v-for="cat in featureCategories"
              :key="cat.id"
              class="explorer-tab"
              :class="{ active: activeCategory === cat.id }"
              @click="activeCategory = cat.id"
            >
              <span class="explorer-tab-icon" v-html="cat.icon"></span>
              <span class="explorer-tab-name">{{ cat.name }}</span>
              <svg class="explorer-tab-arrow" width="13" height="13" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>

          <!-- Code preview -->
          <div class="explorer-preview">
            <!-- Minimal chrome — no macOS dots -->
            <div class="explorer-chrome">
              <Transition name="badge-fade">
                <span class="explorer-replaces" :key="activeCategory">
                  replaces
                  <span>{{ featureCategories.find(c => c.id === activeCategory)?.replaces }}</span>
                </span>
              </Transition>
            </div>
            <Transition name="code-slide" mode="out-in">
              <pre
                class="explorer-code"
                :key="activeCategory"
                v-html="'<code>' + featureCategories.find(c => c.id === activeCategory)?.code + '</code>'"
              ></pre>
            </Transition>
          </div>
        </div>

        <!-- Callout strip -->
        <div class="explorer-callout">
          <span class="callout-num">15+</span>
          <span class="callout-text">npm packages replaced</span>
          <span class="callout-divider">·</span>
          <span class="callout-num">0</span>
          <span class="callout-text">transitive dependencies</span>
          <span class="callout-divider">·</span>
          <span class="callout-num">26</span>
          <span class="callout-text">middleware, all fully typed</span>
        </div>
      </div>
    </section>

    <!-- ── Section 3: Use cases ──────────────────────────────── -->
    <section class="section usecases-section">
      <div class="section-inner reveal-up">
        <p class="section-eyebrow">Real-world patterns</p>
        <h2 class="section-title">Built for how you<br>actually ship.</h2>
        <p class="section-subtitle">
          REST APIs, WebSocket servers, file upload endpoints —
          bunWay handles them all. One import. No plugins.
        </p>

        <div class="usecase-grid reveal-stagger">

          <!-- Card 1: REST API -->
          <div class="usecase-card">
            <div class="usecase-card-header">
              <div class="usecase-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.75">
                  <path d="M8 9l3 3-3 3M13 15h3"/>
                  <rect x="3" y="3" width="18" height="18" rx="4"/>
                </svg>
              </div>
              <div>
                <p class="usecase-title">REST API</p>
                <p class="usecase-desc">Validation · rate limiting · CORS</p>
              </div>
            </div>
            <pre class="usecase-code"><code
><span class="kw">import</span> { bunway, json, cors,
         rateLimit, validate } <span class="kw">from</span> <span class="str">'bunway'</span>

<span class="kw">const</span> app = <span class="fn">bunway</span>()

app.<span class="fn">use</span>(<span class="fn">cors</span>(), <span class="fn">json</span>())
app.<span class="fn">use</span>(<span class="fn">rateLimit</span>({ max: <span class="num">100</span> }))

app.<span class="fn">post</span>(<span class="str">'/users'</span>,
  <span class="fn">validate</span>({ body: {
    email: { required: <span class="kw">true</span>, type: <span class="str">'email'</span> }
  }}),
  (req, res) =&gt; res.<span class="fn">json</span>({ ok: <span class="kw">true</span> })
)
app.<span class="fn">listen</span>(<span class="num">3000</span>)</code></pre>
            <div class="usecase-pills">
              <span>cors()</span><span>json()</span>
              <span>rateLimit()</span><span>validate()</span>
            </div>
          </div>

          <!-- Card 2: WebSocket -->
          <div class="usecase-card usecase-card--highlight">
            <div class="usecase-card-header">
              <div class="usecase-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.75">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <div>
                <p class="usecase-title">Real-time WebSocket</p>
                <p class="usecase-desc">Native Bun WS · no extra packages</p>
              </div>
            </div>
            <pre class="usecase-code"><code
><span class="kw">import</span> { bunway } <span class="kw">from</span> <span class="str">'bunway'</span>

<span class="kw">const</span> app = <span class="fn">bunway</span>()

app.<span class="fn">ws</span>(<span class="str">'/live'</span>, {
  <span class="fn">open</span>(ws) {
    ws.<span class="fn">send</span>(<span class="str">'connected'</span>)
  },
  <span class="fn">message</span>(ws, msg) {
    ws.<span class="fn">send</span>(<span class="str">`echo: ${msg}`</span>)
  },
  <span class="fn">close</span>(ws) {}
})

app.<span class="fn">listen</span>(<span class="num">3000</span>)
<span class="comment">// ws://localhost:3000/live</span></code></pre>
            <div class="usecase-pills">
              <span>app.ws()</span><span>open</span>
              <span>message</span><span>close</span>
            </div>
          </div>

          <!-- Card 3: File Upload -->
          <div class="usecase-card">
            <div class="usecase-card-header">
              <div class="usecase-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.75">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              </div>
              <div>
                <p class="usecase-title">File Upload &amp; Serve</p>
                <p class="usecase-desc">Uploads · static serving · ETag caching</p>
              </div>
            </div>
            <pre class="usecase-code"><code
><span class="kw">import</span> { bunway, upload,
         serveStatic } <span class="kw">from</span> <span class="str">'bunway'</span>

<span class="kw">const</span> app   = <span class="fn">bunway</span>()
<span class="kw">const</span> store = <span class="fn">upload</span>()

app.<span class="fn">use</span>(<span class="str">'/files'</span>, <span class="fn">serveStatic</span>(<span class="str">'./uploads'</span>))

app.<span class="fn">post</span>(<span class="str">'/upload'</span>,
  store.<span class="fn">single</span>(<span class="str">'photo'</span>),
  (req, res) =&gt; res.<span class="fn">json</span>({
    name: req.file?.originalname
  })
)
app.<span class="fn">listen</span>(<span class="num">3000</span>)</code></pre>
            <div class="usecase-pills">
              <span>upload()</span><span>single()</span>
              <span>serveStatic()</span><span>ETag</span>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- ── Section 4: Migration ───────────────────────────────── -->
    <section class="section migration-section">
      <div class="section-inner reveal-up">
        <div class="migration-header">
          <p class="section-eyebrow">Express → bunWay</p>
          <h2 class="migration-headline">Your existing code.<br>One import changed.</h2>
          <p class="migration-sub">Everything else stays exactly the same. No rewrites, no new patterns to learn.</p>
        </div>

        <div class="mig-compare">
          <!-- Before -->
          <div class="mig-panel mig-panel--before">
            <div class="mig-panel-header">
              <span class="mig-label mig-label--bad">Before</span>
              <span class="mig-panel-meta">Express + 14 packages</span>
            </div>
            <div class="mig-terminal">
<pre><span class="t-dim">$</span> npm install express
<span class="t-dim">$</span> npm install cors helmet
<span class="t-dim">$</span> npm install express-session
<span class="t-dim">$</span> npm install morgan compression
<span class="t-dim">$</span> npm install express-rate-limit
<span class="t-dim">$</span> <span class="t-muted">...9 more packages</span>
<span class="t-muted">+ 26 transitive dependencies</span></pre>
            </div>
            <div class="mig-code">
<pre><code><span class="kw">const</span> express = <span class="fn">require</span>(<span class="str">'express'</span>)
<span class="kw">const</span> cors    = <span class="fn">require</span>(<span class="str">'cors'</span>)
<span class="kw">const</span> helmet  = <span class="fn">require</span>(<span class="str">'helmet'</span>)
<span class="kw">const</span> session = <span class="fn">require</span>(<span class="str">'express-session'</span>)
<span class="comment">// 10 more require() calls...</span></code></pre>
            </div>
          </div>

          <!-- Arrow -->
          <div class="mig-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>

          <!-- After -->
          <div class="mig-panel mig-panel--after">
            <div class="mig-panel-header">
              <span class="mig-label mig-label--good">After</span>
              <span class="mig-panel-meta">bunWay</span>
            </div>
            <div class="mig-terminal mig-terminal--good">
<pre><span class="t-dim">$</span> <span class="t-teal">bun add bunway</span>
<span class="t-teal"># that's it.</span></pre>
            </div>
            <div class="mig-code">
<pre><code><span class="kw">import</span> { bunway, cors, helmet,
         session } <span class="kw">from</span> <span class="str">'bunway'</span>
<span class="comment">// cors, helmet, session already inside</span>
<span class="comment">// nothing else to install</span></code></pre>
            </div>
          </div>
        </div>

        <!-- Shared unchanged block — minimal chrome, no dots -->
        <div class="mig-shared">
          <p class="mig-shared-label">Everything below stays identical</p>
          <div class="mig-shared-window">
            <div class="mig-shared-chrome">
              <div class="mig-chrome-tab">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.75">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                app.ts
              </div>
              <span class="mig-shared-badge">unchanged</span>
            </div>
<pre class="mig-shared-code"><code><span class="kw">const</span> app = <span class="fn">bunway</span>()  <span class="comment">// was: express()</span>

app.<span class="fn">use</span>(<span class="fn">cors</span>())
app.<span class="fn">use</span>(<span class="fn">helmet</span>())
app.<span class="fn">use</span>(<span class="fn">session</span>({ secret: <span class="str">'keyboard cat'</span> }))

app.<span class="fn">get</span>(<span class="str">'/users/:id'</span>, (req, res) =&gt; {
  res.<span class="fn">json</span>({ id: req.params.id })
})

app.<span class="fn">listen</span>(<span class="num">3000</span>)</code></pre>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Section 5: Final CTA ───────────────────────────────── -->
    <section class="section cta-section">
      <div class="section-inner reveal-up">
        <div class="cta-block">
          <p class="section-eyebrow">Start now</p>
          <h2 class="cta-headline">Start in 30 seconds.</h2>
          <p class="cta-sub">One command. No config. Your Express app runs on Bun today.</p>

          <button class="cta-install" @click="copyInstall" aria-label="Copy install command">
            <span class="prompt">$</span>
            <span class="cmd">bun add bunway</span>
            <span class="copy-icon" :class="{ copied: installCopied }">
              <svg v-if="!installCopied" width="14" height="14" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
          </button>

          <div class="cta-actions">
            <a href="/guide/getting-started" class="cta-primary">
              Read the docs
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </a>
            <a href="https://github.com/JointOps/bunway" target="_blank" class="cta-secondary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Footer ─────────────────────────────────────────────── -->
    <footer class="landing-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <a href="/" class="footer-logo">bunWay</a>
          <p class="footer-tagline">Express API. Bun speed. Zero dependencies.</p>
        </div>

        <div class="footer-nav">
          <div class="footer-col">
            <p class="footer-col-title">Documentation</p>
            <a href="/guide/getting-started">Getting Started</a>
            <a href="/guide/express-migration">Coming from Express</a>
            <a href="/middleware/index">Middleware</a>
            <a href="/guide/websockets">WebSockets</a>
          </div>
          <div class="footer-col">
            <p class="footer-col-title">Project</p>
            <a href="https://github.com/JointOps/bunway" target="_blank">GitHub</a>
            <a href="https://npmjs.com/package/bunway" target="_blank">npm</a>
            <a href="https://github.com/JointOps/bunway/releases" target="_blank">Changelog</a>
            <a href="/community/build-together">Contribute</a>
          </div>
        </div>
      </div>

      <div class="footer-bottom">
        <p>MIT License · Built by <a href="https://jointops.dev" target="_blank">JointOps</a></p>
        <div class="footer-socials">
          <a href="https://x.com/JointOps_" target="_blank" aria-label="Twitter" class="footer-social">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          <a href="https://github.com/JointOps/bunway" target="_blank" aria-label="GitHub" class="footer-social">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
          <a href="https://discord.gg/fTF4qjaMFT" target="_blank" aria-label="Discord" class="footer-social">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
            </svg>
          </a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ─── Landing base ────────────────────────────────────── */

.landing {
  position: relative;
  min-height: 100vh;
  background: var(--bg-base);
  overflow-x: hidden;
}

/* Single ambient gradient — no JS, no animation, no orbs */
.landing::before {
  content: '';
  position: fixed;
  top: -300px;
  right: -200px;
  width: 900px;
  height: 900px;
  background: radial-gradient(
    circle at 65% 35%,
    rgba(63, 197, 183, 0.055) 0%,
    transparent 55%
  );
  pointer-events: none;
  z-index: 0;
}

/* ─── Shared section skeleton ─────────────────────────── */

.section {
  position: relative;
  z-index: 3;
  padding: var(--space-24) var(--space-6);
}

.section-inner {
  max-width: 1080px;
  margin: 0 auto;
  text-align: center;
}

.section-eyebrow {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: var(--ls-widest);
  text-transform: uppercase;
  color: var(--brand);
  opacity: 0.72;
  margin: 0 0 var(--space-3);
}

.section-title {
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 4vw, var(--text-6xl));
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: var(--ls-tight);
  line-height: var(--lh-snug);
  margin: 0 0 var(--space-4);
}

.section-subtitle {
  font-family: var(--font-body);
  font-size: var(--text-lg);
  color: var(--text-2);
  line-height: var(--lh-relaxed);
  max-width: min(560px, 100%);
  margin: 0 auto var(--space-16);
}

/* ─── Section backgrounds ─────────────────────────────── */

.explorer-section  { background: var(--bg-alt); border-top: 1px solid var(--border); }
.usecases-section  { background: var(--bg-base); border-top: 1px solid var(--border); }
.migration-section { background: var(--bg-alt); border-top: 1px solid var(--border); }
.cta-section       { background: var(--bg-base); border-top: 1px solid var(--border); }

/* ─── Syntax tokens — single source ──────────────────── */

.kw, .explorer-code :deep(.kw)      { color: var(--syn-kw); }
.str, .explorer-code :deep(.str)    { color: var(--syn-str); }
.fn, .explorer-code :deep(.fn)      { color: var(--syn-fn); }
.num, .explorer-code :deep(.num)    { color: var(--syn-num); }
.comment, .explorer-code :deep(.comment) { color: var(--syn-comment); font-style: italic; }

/* ─── Feature Explorer ────────────────────────────────── */

.explorer {
  display: grid;
  grid-template-columns: 240px 1fr;
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
  background: var(--bg-raised);
  margin-bottom: var(--space-10);
  text-align: left;
}

.explorer-tabs {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
}

.explorer-tab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 14px 18px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  text-align: left;
  transition: background var(--dur-fast) ease;
}

.explorer-tab:last-child {
  border-bottom: none;
}

.explorer-tab:hover:not(.active) {
  background: rgba(255, 255, 255, 0.025);
}

.explorer-tab.active {
  background: var(--brand-8);
  border-right: 2px solid var(--brand);
}

.explorer-tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--brand-8);
  border-radius: var(--r-xs);
  color: var(--text-3);
  flex-shrink: 0;
  transition: color var(--dur-fast) ease, background var(--dur-fast) ease;
}

.explorer-tab.active .explorer-tab-icon {
  color: var(--brand);
  background: var(--brand-12);
}

.explorer-tab-name {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-3);
  flex: 1;
  transition: color var(--dur-fast) ease;
}

.explorer-tab.active .explorer-tab-name {
  color: var(--text-1);
  font-weight: 600;
}

.explorer-tab-arrow {
  color: var(--text-4);
  flex-shrink: 0;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity var(--dur-fast) ease, transform var(--dur-fast) ease;
}

.explorer-tab.active .explorer-tab-arrow {
  opacity: 1;
  transform: translateX(0);
  color: var(--brand);
}

.explorer-preview {
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

/* Explorer chrome — no macOS dots */
.explorer-chrome {
  display: flex;
  align-items: center;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.015);
  border-bottom: 1px solid var(--border);
  min-height: 40px;
}

.explorer-replaces {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-3);
  letter-spacing: var(--ls-normal);
}

.explorer-replaces span {
  color: var(--text-2);
  margin-left: 6px;
}

.explorer-code {
  margin: 0;
  padding: var(--space-6) var(--space-8);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: var(--lh-loose);
  color: var(--text-code);
  overflow-x: auto;
  background: transparent;
  border: none;
  border-radius: 0;
  flex: 1;
}

/* Code slide transition — symmetric */
.code-slide-enter-active,
.code-slide-leave-active { transition: opacity var(--dur-base) ease, transform var(--dur-base) ease; }
.code-slide-enter-from   { opacity: 0; transform: translateX(8px); }
.code-slide-leave-to     { opacity: 0; transform: translateX(-8px); }

.badge-fade-enter-active,
.badge-fade-leave-active { transition: opacity 0.2s ease; }
.badge-fade-enter-from,
.badge-fade-leave-to     { opacity: 0; }

/* ─── Explorer callout strip ──────────────────────────── */

.explorer-callout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-8);
  background: var(--brand-4);
  border: 1px solid var(--brand-12);
  border-radius: var(--r-md);
  flex-wrap: wrap;
}

.callout-num {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 900;
  color: var(--brand);
  line-height: 1;
  letter-spacing: var(--ls-tight);
}

.callout-text {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-2);
}

.callout-divider {
  color: var(--border-mid);
  font-size: var(--text-lg);
}

/* ─── Use-case cards ──────────────────────────────────── */

.usecase-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
  text-align: left;
}

.usecase-card {
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color var(--dur-base) ease, box-shadow var(--dur-base) ease;
}

.usecase-card:hover {
  border-color: var(--border-brand);
  box-shadow: 0 0 40px -12px rgba(63, 197, 183, 0.1);
}

.usecase-card--highlight {
  border-color: var(--border-brand);
  background: var(--brand-4);
}

.usecase-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-5) 0;
}

.usecase-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: var(--brand-8);
  border-radius: var(--r-sm);
  color: var(--brand);
  flex-shrink: 0;
}

.usecase-title {
  font-family: var(--font-body);
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text-1);
  margin: 0 0 3px;
  letter-spacing: var(--ls-snug);
}

.usecase-desc {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-3);
  margin: 0;
}

.usecase-code {
  margin: var(--space-3) 0 0;
  padding: var(--space-4) var(--space-5);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  line-height: var(--lh-loose);
  color: var(--text-code);
  background: rgba(0, 0, 0, 0.2);
  border: none;
  border-radius: 0;
  overflow-x: auto;
  flex: 1;
}

.usecase-pills {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  flex-wrap: wrap;
}

.usecase-pills span {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--brand);
  background: var(--brand-8);
  padding: 3px 8px;
  border-radius: var(--r-xs);
  border: 1px solid var(--brand-12);
}

/* ─── Migration section ───────────────────────────────── */

.migration-header {
  margin-bottom: var(--space-10);
}

.migration-headline {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 3.5vw, var(--text-5xl));
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: var(--ls-tight);
  line-height: var(--lh-snug);
  margin: 0 0 var(--space-3);
}

.migration-sub {
  font-family: var(--font-body);
  font-size: var(--text-lg);
  color: var(--text-2);
  margin: 0;
  line-height: var(--lh-relaxed);
}

.mig-compare {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  margin-bottom: var(--space-6);
  text-align: left;
  gap: 0;
}

.mig-panel {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mig-panel--after {
  border-color: var(--border-brand);
  box-shadow: 0 0 50px -15px rgba(63, 197, 183, 0.1);
}

.mig-panel-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--border);
}

.mig-label {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--ls-widest);
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: var(--r-xs);
}

.mig-label--bad  { background: var(--red-dim);    color: var(--red);   }
.mig-label--good { background: var(--brand-12);   color: var(--brand); }

.mig-panel-meta {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-3);
}

.mig-terminal {
  padding: 12px 16px;
  background: var(--bg-inset);
  border-bottom: 1px solid var(--border);
}

.mig-terminal pre {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: var(--lh-relaxed);
  color: var(--text-3);
  background: transparent;
  border: none;
  border-radius: 0;
}

.mig-terminal--good pre { color: var(--text-2); }

.t-dim   { color: var(--text-4); }
.t-muted { color: var(--text-4); font-style: italic; }
.t-teal  { color: var(--brand); }

.mig-code {
  padding: 12px 16px;
}

.mig-code pre {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: var(--lh-relaxed);
  color: var(--text-code);
  background: transparent;
  border: none;
  border-radius: 0;
  overflow-x: auto;
}

.mig-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-5);
  color: var(--text-4);
  flex-shrink: 0;
}

/* ─── Shared unchanged block ──────────────────────────── */

.mig-shared {
  margin-bottom: var(--space-10);
  text-align: left;
}

.mig-shared-label {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: var(--ls-wider);
  text-transform: uppercase;
  color: var(--text-4);
  text-align: center;
  margin: 0 0 var(--space-3);
}

.mig-shared-window {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
  max-width: 560px;
  margin: 0 auto;
}

/* Minimal chrome — no macOS dots */
.mig-shared-chrome {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--border);
}

.mig-chrome-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-3);
}

.mig-shared-badge {
  margin-left: auto;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-3);
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 7px;
  border-radius: var(--r-xs);
  letter-spacing: var(--ls-wider);
  text-transform: uppercase;
}

.mig-shared-code {
  margin: 0;
  padding: 16px 20px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: var(--lh-loose);
  color: var(--text-code);
  background: transparent;
  border: none;
  border-radius: 0;
  overflow-x: auto;
}

/* ─── Final CTA section ───────────────────────────────── */

.cta-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 540px;
  margin: 0 auto;
}

.cta-headline {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 3.5vw, var(--text-5xl));
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: var(--ls-tight);
  line-height: var(--lh-snug);
  margin: 0 0 var(--space-4);
}

.cta-sub {
  font-family: var(--font-body);
  font-size: var(--text-lg);
  color: var(--text-2);
  line-height: var(--lh-relaxed);
  margin: 0 0 var(--space-8);
  text-align: center;
}

.cta-install {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  padding: 14px 20px;
  background: var(--bg-raised);
  border: 1px solid var(--border-mid);
  border-radius: var(--r-sm);
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--text-1);
  cursor: pointer;
  margin-bottom: var(--space-8);
  transition: border-color var(--dur-fast) ease,
              background var(--dur-fast) ease,
              transform var(--dur-fast) ease;
}

.cta-install:hover {
  border-color: var(--border-brand);
  background: var(--bg-overlay);
  transform: translateY(-1px);
}

.cta-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
}

.cta-primary,
.cta-secondary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 44px;
  padding: 0 var(--space-6);
  border-radius: var(--r-sm);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: var(--ls-wide);
  text-decoration: none;
  transition: transform var(--dur-fast) ease,
              box-shadow var(--dur-fast) ease,
              background var(--dur-fast) ease,
              border-color var(--dur-fast) ease,
              color var(--dur-fast) ease;
}

.cta-primary {
  background: linear-gradient(135deg, #3fc5b7 0%, #38e8de 100%);
  color: #042420;
  font-weight: 700;
}

.cta-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-brand);
}

.cta-primary svg { transition: transform var(--dur-fast) ease; }
.cta-primary:hover svg { transform: translateX(3px); }

.cta-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--text-2);
}

.cta-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--border-mid);
  color: var(--text-1);
  transform: translateY(-1px);
}

/* ─── Footer ──────────────────────────────────────────── */

.landing-footer {
  position: relative;
  z-index: 3;
  background: var(--bg-inset);
  border-top: 1px solid var(--border);
  padding: var(--space-12) var(--space-6) var(--space-6);
}

.footer-inner {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-12);
  max-width: 1080px;
  margin: 0 auto var(--space-8);
  align-items: start;
}

.footer-brand {
  max-width: 260px;
}

.footer-logo {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  letter-spacing: var(--ls-snug);
  color: var(--text-1);
  text-decoration: none;
  display: block;
  margin-bottom: var(--space-2);
  transition: color var(--dur-fast) ease;
}

.footer-logo:hover {
  color: var(--brand);
}

.footer-tagline {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-3);
  line-height: var(--lh-relaxed);
  margin: 0;
}

.footer-nav {
  display: flex;
  gap: var(--space-12);
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.footer-col-title {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--ls-wider);
  color: var(--text-3);
  margin: 0 0 var(--space-2);
}

.footer-col a {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-3);
  text-decoration: none;
  transition: color var(--dur-fast) ease;
}

.footer-col a:hover {
  color: var(--text-1);
}

.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1080px;
  margin: 0 auto;
  padding-top: var(--space-5);
  border-top: 1px solid var(--border);
}

.footer-bottom p {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-4);
  margin: 0;
}

.footer-bottom p a {
  color: var(--text-3);
  text-decoration: none;
  transition: color var(--dur-fast) ease;
}

.footer-bottom p a:hover { color: var(--brand); }

.footer-socials {
  display: flex;
  gap: var(--space-1);
}

.footer-social {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--r-xs);
  color: var(--text-4);
  transition: color var(--dur-fast) ease, background var(--dur-fast) ease;
}

.footer-social:hover {
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.06);
}

/* ─── Responsive ──────────────────────────────────────── */

@media (max-width: 900px) {
  .section { padding: var(--space-20) var(--space-5); }

  .usecase-grid {
    grid-template-columns: 1fr;
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  }

  .footer-inner {
    grid-template-columns: 1fr;
    gap: var(--space-8);
  }
}

@media (max-width: 860px) {
  .explorer {
    grid-template-columns: 1fr;
  }

  .explorer-tabs {
    flex-direction: row;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
    -webkit-overflow-scrolling: touch;
  }

  .explorer-tab {
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: 12px 14px;
    border-bottom: none;
    border-right: 1px solid var(--border);
    min-width: 80px;
    text-align: center;
  }

  .explorer-tab.active {
    border-right: 1px solid var(--border);
    border-bottom: 2px solid var(--brand);
  }

  .explorer-tab-arrow { display: none; }
  .explorer-tab-name  { font-size: var(--text-xs); }
}

@media (max-width: 680px) {
  .mig-compare {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }

  .mig-arrow {
    display: none;
  }

  .mig-panel--before { order: 1; }
  .mig-panel--after  { order: 2; }
}

@media (max-width: 640px) {
  .section         { padding: var(--space-16) var(--space-4); }
  .section-title   { font-size: var(--text-3xl); }
  .section-subtitle { font-size: var(--text-base); margin-bottom: var(--space-10); }
  .usecase-grid    { max-width: 100%; }

  .callout-num     { font-size: var(--text-xl); }
  .callout-text    { font-size: var(--text-xs); }

  .cta-actions {
    flex-direction: column;
    width: 100%;
  }

  .cta-primary, .cta-secondary {
    width: 100%;
    max-width: 320px;
    justify-content: center;
  }

  .footer-nav {
    gap: var(--space-8);
  }

  .footer-bottom {
    flex-direction: column;
    gap: var(--space-4);
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing::before { display: none; }
}
</style>
