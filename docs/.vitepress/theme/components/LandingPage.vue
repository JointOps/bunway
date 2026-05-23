<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import HeroSection from './HeroSection.vue'

const containerRef = ref(null)
let rafId = null
let mouseX = 0
let mouseY = 0

const handleMouseMove = (e) => {
  mouseX = e.clientX
  mouseY = e.clientY
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReducedMotion) return

  const animate = () => {
    if (containerRef.value) {
      containerRef.value.style.setProperty('--mouse-x', `${mouseX}px`)
      containerRef.value.style.setProperty('--mouse-y', `${mouseY}px`)
    }
    rafId = requestAnimationFrame(animate)
  }
  animate()
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  if (rafId) cancelAnimationFrame(rafId)
})

// ── Feature Explorer ────────────────────────────────────
const activeCategory = ref('security')

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
app.<span class="fn">use</span>(<span class="fn">cors</span>({ origin: /\\.myapp\\.com$/ }))  <span class="comment">// CORS + preflight</span>
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

app.<span class="fn">use</span>(<span class="fn">cookieParser</span>(<span class="str">'your-secret'</span>))         <span class="comment">// signed cookies</span>
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

app.<span class="fn">post</span>(<span class="str">'/upload'</span>, store.<span class="fn">single</span>(<span class="str">'photo'</span>), (req, res) =&gt; {
  res.<span class="fn">json</span>({ name: req.file?.originalname })   <span class="comment">// Range + 206 supported</span>
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

app.<span class="fn">get</span>(<span class="str">'/events'</span>, <span class="fn">sse</span>(), (req, res) =&gt; {
  res.<span class="fn">sendEvent</span>(<span class="str">'update'</span>, { ts: <span class="fn">Date.now</span>() })  <span class="comment">// Server-Sent Events</span>
})`
  },
  {
    id: 'utilities',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>`,
    name: 'Utilities',
    replaces: 'compression · connect-timeout · express-validator · method-override',
    code: `<span class="kw">import</span> { bunway, compression, timeout, validate, methodOverride } <span class="kw">from</span> <span class="str">'bunway'</span>

<span class="kw">const</span> app = <span class="fn">bunway</span>()

app.<span class="fn">use</span>(<span class="fn">compression</span>())       <span class="comment">// Brotli &gt; gzip &gt; deflate</span>
app.<span class="fn">use</span>(<span class="fn">timeout</span>(<span class="num">5000</span>))        <span class="comment">// 5s request timeout</span>
app.<span class="fn">use</span>(<span class="fn">methodOverride</span>())     <span class="comment">// PUT/DELETE from forms</span>

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
  <div ref="containerRef" class="landing">
    <!-- Gradient orbs -->
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>

    <!-- Mouse glow -->
    <div class="mouse-glow"></div>

    <!-- Noise texture -->
    <div class="noise"></div>

    <!-- Grid pattern -->
    <div class="grid"></div>

    <!-- Hero -->
    <HeroSection />

    <!-- ── Section 2: Interactive Feature Explorer ──────────── -->
    <section class="section explorer-section">
      <div class="section-inner">
        <p class="section-eyebrow">What's inside</p>
        <h2 class="section-title">Everything included.<br>Nothing to install.</h2>
        <p class="section-subtitle">
          Every package Express developers reach for — already inside bunWay.
          No npm install. No version conflicts. No supply chain risk.
        </p>

        <!-- Feature explorer: tabs left, code right -->
        <div class="explorer">
          <!-- Category tabs (left column) -->
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
              <svg class="explorer-tab-arrow" width="14" height="14" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>

          <!-- Code preview (right column) -->
          <div class="explorer-preview">
            <div class="explorer-chrome">
              <span class="dot red"></span>
              <span class="dot yellow"></span>
              <span class="dot green"></span>
              <Transition name="badge-fade">
                <span class="explorer-replaces" :key="activeCategory">
                  Replaces:
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

        <!-- Bottom callout -->
        <div class="explorer-callout">
          <span class="callout-num">15+</span>
          <span class="callout-text">npm packages replaced with a single import</span>
          <span class="callout-divider">·</span>
          <span class="callout-num">0</span>
          <span class="callout-text">transitive dependencies</span>
          <span class="callout-divider">·</span>
          <span class="callout-num">24</span>
          <span class="callout-text">middleware, all fully typed</span>
        </div>
      </div>
    </section>

    <!-- ── Section 3: Real-world use cases + migration ──────── -->
    <section class="section usecases-section">
      <div class="section-inner">
        <p class="section-eyebrow">Real-world patterns</p>
        <h2 class="section-title">Built for how you<br>actually ship.</h2>
        <p class="section-subtitle">
          REST APIs, WebSocket servers, file upload endpoints —
          bunWay handles them all. One import. No plugins.
        </p>

        <!-- Use case cards -->
        <div class="usecase-grid">

          <!-- Card 1: REST API -->
          <div class="usecase-card">
            <div class="usecase-card-header">
              <div class="usecase-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
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

          <!-- Card 3: File Upload & Serve -->
          <div class="usecase-card">
            <div class="usecase-card-header">
              <div class="usecase-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
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

    <!-- ── Section 4: Express → bunWay migration ─────────── -->
    <section class="section migration-section">
      <div class="section-inner">

        <!-- ── Migration: side-by-side comparison ────────── -->
        <div class="migration-divider">
          <p class="section-eyebrow" style="margin: 0 0 16px">Express → bunWay</p>
          <h3 class="migration-headline">Your existing code.<br>One import changed.</h3>
          <p class="migration-sub">Everything else stays exactly the same. No rewrites, no new patterns to learn.</p>
        </div>

        <div class="mig-compare">
          <!-- Before panel -->
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
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>

          <!-- After panel -->
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

        <!-- Shared: the rest of the code doesn't change -->
        <div class="mig-shared">
          <p class="mig-shared-label">Everything below stays identical</p>
          <div class="mig-shared-window">
            <div class="mig-shared-chrome">
              <span class="dot red"></span>
              <span class="dot yellow"></span>
              <span class="dot green"></span>
              <span class="mig-shared-filename">app.ts</span>
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

    <!-- ── Enhanced footer ──────────────────────────────────── -->
    <footer class="landing-footer">
      <div class="footer-inner">
        <p class="footer-copy">MIT Licensed. Built by <a href="https://jointops.dev" target="_blank">JointOps</a>.</p>
        <div class="footer-links">
          <a href="https://github.com/JointOps/bunway" target="_blank">GitHub</a>
          <a href="https://npmjs.com/package/bunway" target="_blank">npm</a>
          <a href="/guide/getting-started">Docs</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  --mouse-x: 50vw;
  --mouse-y: 50vh;

  position: relative;
  min-height: 100vh;
  background: #0a0a0a;
  overflow: hidden;
}

/* ─── Gradient orbs ───────────────────────────────────── */

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  animation: float 20s ease-in-out infinite;
}

.orb-1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(63, 197, 183, 0.3) 0%, transparent 70%);
  top: -200px;
  right: -100px;
  animation-delay: 0s;
}

.orb-2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.25) 0%, transparent 70%);
  bottom: -150px;
  left: -100px;
  animation-delay: -7s;
}

.orb-3 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(129, 140, 248, 0.2) 0%, transparent 70%);
  top: 40%;
  left: 50%;
  transform: translateX(-50%);
  animation-delay: -14s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(30px, -30px); }
  50% { transform: translate(-20px, 20px); }
  75% { transform: translate(20px, 30px); }
}

/* ─── Mouse glow ──────────────────────────────────────── */


/* ─── Noise texture ───────────────────────────────────── */

.noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
  z-index: 2;
}

/* ─── Subtle grid ─────────────────────────────────────── */

.grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
  background-size: 60px 60px;
  pointer-events: none;
  z-index: 0;
}

/* ─── Shared section skeleton ────────────────────────── */

.section {
  position: relative;
  z-index: 3;
  padding: 100px 24px;
}

.usecases-section {
  background: #070707;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

/* ─── Use-case cards ──────────────────────────────────── */

.usecase-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 80px;
  text-align: left;
}

.usecase-card {
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.usecase-card:hover {
  border-color: rgba(63, 197, 183, 0.22);
  box-shadow: 0 0 40px -12px rgba(63, 197, 183, 0.1);
}

.usecase-card--highlight {
  border-color: rgba(63, 197, 183, 0.18);
  background: rgba(63, 197, 183, 0.03);
  box-shadow: 0 0 60px -20px rgba(63, 197, 183, 0.12);
}

.usecase-card-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 20px 0;
}

.usecase-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(63, 197, 183, 0.1);
  border-radius: 10px;
  color: #3fc5b7;
  flex-shrink: 0;
}

.usecase-title {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 3px;
  letter-spacing: -0.01em;
}

.usecase-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
}

.usecase-code {
  margin: 14px 0 0;
  padding: 16px 20px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.65);
  background: rgba(0, 0, 0, 0.25);
  border: none;
  border-radius: 0;
  overflow-x: auto;
  flex: 1;
}

.usecase-code .kw      { color: #c678dd; }
.usecase-code .str     { color: #98c379; }
.usecase-code .fn      { color: #61afef; }
.usecase-code .num     { color: #d19a66; }
.usecase-code .comment { color: rgba(255, 255, 255, 0.2); font-style: italic; }

.usecase-pills {
  display: flex;
  gap: 6px;
  padding: 14px 20px;
  flex-wrap: wrap;
}

.usecase-pills span {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #3fc5b7;
  background: rgba(63, 197, 183, 0.08);
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(63, 197, 183, 0.15);
}

/* ─── Section divider ─────────────────────────────────── */

.section-divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(63, 197, 183, 0.2) 30%,
    rgba(63, 197, 183, 0.2) 70%,
    transparent 100%
  );
  margin: 0 0 80px;
}

/* ─── Migration divider header ────────────────────────── */

.migration-divider {
  margin-bottom: 36px;
}

.migration-headline {
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 0 0 10px;
}

.migration-sub {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.45);
  margin: 0;
}

.section-inner {
  max-width: 1080px;
  margin: 0 auto;
  text-align: center;
}

.section-eyebrow {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #3fc5b7;
  margin: 0 0 16px;
}

.section-title {
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin: 0 0 16px;
}

.section-subtitle {
  font-size: 17px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.7;
  max-width: 580px;
  margin: 0 auto 64px;
}

/* ─── Feature Explorer ────────────────────────────────── */

.explorer-section {
  background: #0e0e0e;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.explorer {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 0;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 20px;
  overflow: hidden;
  background: #0f0f0f;
  margin-bottom: 48px;
  text-align: left;
}

/* ─── Left column: tab buttons ────────────────────────── */

.explorer-tabs {
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.015);
}

.explorer-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer;
  text-align: left;
  transition: background 0.18s, border-color 0.18s;
  position: relative;
}

.explorer-tab:last-child {
  border-bottom: none;
}

.explorer-tab:hover {
  background: rgba(255, 255, 255, 0.03);
}

.explorer-tab.active {
  background: rgba(63, 197, 183, 0.07);
  border-right: 2px solid #3fc5b7;
}

.explorer-tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: rgba(63, 197, 183, 0.08);
  border-radius: 7px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
  transition: color 0.18s, background 0.18s;
}

.explorer-tab.active .explorer-tab-icon {
  color: #3fc5b7;
  background: rgba(63, 197, 183, 0.14);
}

.explorer-tab-name {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
  flex: 1;
  transition: color 0.18s;
}

.explorer-tab.active .explorer-tab-name {
  color: #fff;
}

.explorer-tab-arrow {
  color: rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.18s, transform 0.18s, color 0.18s;
}

.explorer-tab.active .explorer-tab-arrow {
  opacity: 1;
  transform: translateX(0);
  color: #3fc5b7;
}

/* ─── Right column: code preview ──────────────────────── */

.explorer-preview {
  display: flex;
  flex-direction: column;
  min-height: 320px;
}

.explorer-chrome {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 18px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.explorer-replaces {
  margin-left: 12px;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.3);
  font-family: 'JetBrains Mono', monospace;
}

.explorer-replaces span {
  color: rgba(255, 255, 255, 0.5);
}

.explorer-code {
  margin: 0;
  padding: 24px 28px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.85;
  color: rgba(255, 255, 255, 0.72);
  overflow-x: auto;
  background: transparent;
  border: none;
  border-radius: 0;
  flex: 1;
}

.explorer-code :deep(.kw)      { color: #c678dd; }
.explorer-code :deep(.str)     { color: #98c379; }
.explorer-code :deep(.fn)      { color: #61afef; }
.explorer-code :deep(.num)     { color: #d19a66; }
.explorer-code :deep(.comment) { color: rgba(255, 255, 255, 0.22); font-style: italic; }

/* ─── Code slide transition ───────────────────────────── */

.code-slide-enter-active { transition: all 0.2s ease; }
.code-slide-leave-active { transition: all 0.14s ease; }
.code-slide-enter-from   { opacity: 0; transform: translateX(10px); }
.code-slide-leave-to     { opacity: 0; transform: translateX(-8px); }

/* ─── Callout strip ───────────────────────────────────── */

.explorer-callout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px 28px;
  background: rgba(63, 197, 183, 0.04);
  border: 1px solid rgba(63, 197, 183, 0.12);
  border-radius: 14px;
  flex-wrap: wrap;
}

.callout-num {
  font-size: 20px;
  font-weight: 800;
  background: linear-gradient(135deg, #3fc5b7 0%, #22d3ee 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
}

.callout-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
}

.callout-divider {
  color: rgba(255, 255, 255, 0.15);
  font-size: 16px;
}

/* ─── Migration comparison ────────────────────────────── */

.badge-fade-enter-active,
.badge-fade-leave-active { transition: opacity 0.25s ease; }
.badge-fade-enter-from,
.badge-fade-leave-to     { opacity: 0; }

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot.red    { background: #ff5f57; }
.dot.yellow { background: #febc2e; }
.dot.green  { background: #28c840; }

.mig-compare {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  margin-bottom: 24px;
  text-align: left;
}

.mig-panel {
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mig-panel--after {
  border-color: rgba(63, 197, 183, 0.2);
  box-shadow: 0 0 50px -15px rgba(63, 197, 183, 0.12);
}

.mig-panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.mig-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 4px;
}

.mig-label--bad  { background: rgba(239, 68, 68, 0.12); color: #f87171; }
.mig-label--good { background: rgba(63, 197, 183, 0.12); color: #3fc5b7; }

.mig-panel-meta {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.28);
  font-family: 'JetBrains Mono', monospace;
}

.mig-terminal {
  padding: 14px 18px;
  background: rgba(0, 0, 0, 0.35);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.mig-terminal pre {
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.55);
  background: transparent;
  border: none;
  border-radius: 0;
}

.mig-terminal--good pre { color: rgba(255, 255, 255, 0.6); }

.t-dim   { color: rgba(255, 255, 255, 0.2); }
.t-muted { color: rgba(255, 255, 255, 0.22); font-style: italic; }
.t-teal  { color: #3fc5b7; }

.mig-code {
  padding: 14px 18px;
}

.mig-code pre {
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.65);
  background: transparent;
  border: none;
  border-radius: 0;
  overflow-x: auto;
}

.mig-code .kw      { color: #c678dd; }
.mig-code .str     { color: #98c379; }
.mig-code .fn      { color: #61afef; }
.mig-code .comment { color: rgba(255, 255, 255, 0.22); font-style: italic; }

.mig-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  color: rgba(255, 255, 255, 0.18);
  flex-shrink: 0;
}

/* ─── Shared unchanged block ──────────────────────────── */

.mig-shared {
  margin-bottom: 40px;
  text-align: left;
}

.mig-shared-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.2);
  text-align: center;
  margin: 0 0 12px;
}

.mig-shared-window {
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  overflow: hidden;
  max-width: 560px;
  margin: 0 auto;
}

.mig-shared-chrome {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 11px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.mig-shared-filename {
  margin-left: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  font-family: 'JetBrains Mono', monospace;
}

.mig-shared-badge {
  margin-left: auto;
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 7px;
  border-radius: 4px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.mig-shared-code {
  margin: 0;
  padding: 18px 22px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  line-height: 1.85;
  color: rgba(255, 255, 255, 0.45);
  background: transparent;
  border: none;
  border-radius: 0;
  overflow-x: auto;
}

.mig-shared-code .kw      { color: #c678dd; }
.mig-shared-code .str     { color: #98c379; }
.mig-shared-code .fn      { color: #61afef; }
.mig-shared-code .num     { color: #d19a66; }
.mig-shared-code .comment { color: rgba(255, 255, 255, 0.2); font-style: italic; }

/* ─── Evidence strip ──────────────────────────────────── */

.evidence-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 40px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
}

.evidence-strip .sep { color: rgba(255, 255, 255, 0.15); }

/* ─── Final CTAs ──────────────────────────────────────── */

.cta-row {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.cta-primary,
.cta-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 26px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
}

.cta-primary {
  background: linear-gradient(135deg, #3fc5b7 0%, #22d3ee 100%);
  color: #000;
}

.cta-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(63, 197, 183, 0.35);
}

.cta-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
}

.cta-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

/* ─── Footer ──────────────────────────────────────────── */

.landing-footer {
  position: relative;
  z-index: 3;
  background: rgba(0, 0, 0, 0.44);
  padding: 18px 28px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1080px;
  margin: 0 auto;
}

.footer-copy {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
  margin: 0;
}

.footer-copy a {
  color: rgba(255, 255, 255, 0.45);
  text-decoration: none;
  transition: color 0.2s;
}

.footer-copy a:hover { color: #3fc5b7; }

.footer-links {
  display: flex;
  gap: 24px;
}

.footer-links a {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.3);
  text-decoration: none;
  transition: color 0.2s;
}

.footer-links a:hover { color: rgba(255, 255, 255, 0.7); }

/* ─── Responsive ──────────────────────────────────────── */

@media (max-width: 900px) {
  .section { padding: 72px 20px; }

  .usecase-grid {
    grid-template-columns: 1fr;
    max-width: 520px;
    margin-left: auto;
    margin-right: auto;
  }

  .mig-window {
    max-width: 100%;
  }

  .mode-btn {
    padding: 10px 24px;
  }

  .footer-inner {
    flex-direction: column;
    gap: 16px;
    text-align: center;
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
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    -webkit-overflow-scrolling: touch;
  }

  .explorer-tab {
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 14px;
    border-bottom: none;
    border-right: 1px solid rgba(255, 255, 255, 0.04);
    min-width: 90px;
    text-align: center;
  }

  .explorer-tab.active {
    border-right: 1px solid rgba(255, 255, 255, 0.04);
    border-bottom: 2px solid #3fc5b7;
  }

  .explorer-tab-arrow { display: none; }

  .explorer-tab-name { font-size: 11px; }
}

@media (max-width: 640px) {
  .section { padding: 60px 16px; }
  .section-title { font-size: 30px; }
  .section-subtitle { font-size: 15px; margin-bottom: 40px; }

  .usecase-grid { max-width: 100%; }

  .evidence-strip {
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
  }

  .evidence-strip .sep { display: none; }

  .cta-row { flex-direction: column; align-items: center; }
  .cta-primary, .cta-secondary {
    width: 100%;
    max-width: 300px;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .orb { animation: none; }
}
</style>
