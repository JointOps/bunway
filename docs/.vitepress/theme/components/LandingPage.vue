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

const features = [
  {
    icon: '0',
    label: 'Dependencies',
    desc: 'Zero production dependencies. Pure Bun, no Node.js polyfills.'
  },
  {
    icon: '16',
    label: 'Built-in Middleware',
    desc: 'CORS, sessions, auth, uploads, rate limiting — all included.'
  },
  {
    icon: '95%',
    label: 'Express API Coverage',
    desc: 'Same req, res, next. Same routing. Same middleware patterns.'
  },
  {
    icon: '3-4×',
    label: 'Faster Than Node',
    desc: 'Built on Bun.serve() for native HTTP performance.'
  }
]

const middleware = [
  { bunway: 'json()', express: 'express.json()' },
  { bunway: 'cors()', express: 'cors' },
  { bunway: 'helmet()', express: 'helmet' },
  { bunway: 'session()', express: 'express-session' },
  { bunway: 'logger()', express: 'morgan' },
  { bunway: 'upload()', express: 'multer' },
  { bunway: 'rateLimit()', express: 'express-rate-limit' },
  { bunway: 'passport()', express: 'passport' },
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

    <!-- SEO Content Sections -->
    <section class="seo-section">
      <div class="section-inner">
        <h2 class="section-title">Why developers choose bunWay</h2>
        <p class="section-subtitle">
          bunWay is an Express-compatible web framework built natively for Bun.
          If you've written Express, you already know bunWay — same middleware,
          same routing, same <code>(req, res, next)</code> handler signature.
        </p>

        <div class="features-grid">
          <div v-for="f in features" :key="f.label" class="feature-card">
            <span class="feature-number">{{ f.icon }}</span>
            <h3>{{ f.label }}</h3>
            <p>{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="seo-section alt">
      <div class="section-inner">
        <h2 class="section-title">Built-in middleware — no npm install required</h2>
        <p class="section-subtitle">
          Every Express middleware you rely on has a built-in bunWay equivalent.
          One import, no version conflicts, no <code>node_modules</code> sprawl.
        </p>

        <div class="middleware-table">
          <div class="table-header">
            <span>bunWay (built-in)</span>
            <span>Replaces</span>
          </div>
          <div v-for="m in middleware" :key="m.bunway" class="table-row">
            <code class="bunway-code">{{ m.bunway }}</code>
            <span class="express-pkg">{{ m.express }}</span>
          </div>
          <div class="table-footer">
            <a href="/middleware/">See all 16 middleware →</a>
          </div>
        </div>
      </div>
    </section>

    <section class="seo-section">
      <div class="section-inner">
        <h2 class="section-title">Express-compatible. Zero rewrites.</h2>
        <p class="section-subtitle">
          bunWay implements the Express API surface so your existing code works.
          Routes, middleware, sub-routers, error handling — all the patterns you know.
        </p>

        <div class="code-example">
          <div class="code-header">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
            <span class="filename">app.ts</span>
          </div>
          <pre class="code-block"><code><span class="kw">import</span> { bunway, cors, helmet, json, session } <span class="kw">from</span> <span class="str">"bunway"</span>

<span class="kw">const</span> app = <span class="fn">bunway</span>()

app.<span class="fn">use</span>(<span class="fn">cors</span>())
app.<span class="fn">use</span>(<span class="fn">helmet</span>())
app.<span class="fn">use</span>(<span class="fn">json</span>())
app.<span class="fn">use</span>(<span class="fn">session</span>({ secret: <span class="str">"keyboard cat"</span> }))

app.<span class="fn">get</span>(<span class="str">"/users/:id"</span>, (req, res) => {
  res.<span class="fn">json</span>({ id: req.params.id })
})

app.<span class="fn">listen</span>(<span class="num">3000</span>)</code></pre>
        </div>

        <div class="cta-row">
          <a href="/guide/getting-started" class="cta-primary">Get Started</a>
          <a href="/guide/express-migration" class="cta-secondary">Express Migration Guide</a>
        </div>
      </div>
    </section>

    <footer class="landing-footer">
      <p>MIT Licensed. Built by <a href="https://jointops.dev" target="_blank">JointOps</a>.</p>
      <div class="footer-links">
        <a href="https://github.com/JointOps/bunway" target="_blank">GitHub</a>
        <a href="https://www.npmjs.com/package/bunway" target="_blank">npm</a>
        <a href="https://discord.gg/fTF4qjaMFT" target="_blank">Discord</a>
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
  background: #050505;
  overflow: hidden;
}

/* Gradient orbs */
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

/* Mouse glow */
.mouse-glow {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  background: radial-gradient(
    600px circle at var(--mouse-x) var(--mouse-y),
    rgba(63, 197, 183, 0.06),
    transparent 40%
  );
  z-index: 1;
}

/* Noise texture */
.noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
  z-index: 2;
}

/* Subtle grid */
.grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 60px 60px;
  pointer-events: none;
  z-index: 0;
  mask-image: radial-gradient(ellipse 80% 50% at 50% 50%, black, transparent);
}

/* SEO Content Sections */
.seo-section {
  position: relative;
  z-index: 3;
  padding: 80px 24px;
}

.seo-section.alt {
  background: rgba(255, 255, 255, 0.02);
}

.section-inner {
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
}

.section-title {
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
  margin: 0 0 16px;
}

.section-subtitle {
  font-size: 17px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.7;
  max-width: 640px;
  margin: 0 auto 48px;
}

.section-subtitle code {
  color: #3fc5b7;
  background: rgba(63, 197, 183, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

/* Feature cards */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.feature-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 28px 24px;
  text-align: left;
  transition: border-color 0.2s;
}

.feature-card:hover {
  border-color: rgba(63, 197, 183, 0.3);
}

.feature-number {
  font-size: 32px;
  font-weight: 800;
  background: linear-gradient(135deg, #3fc5b7 0%, #22d3ee 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: block;
  margin-bottom: 8px;
}

.feature-card h3 {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 8px;
}

.feature-card p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.6;
  margin: 0;
}

/* Middleware table */
.middleware-table {
  max-width: 480px;
  margin: 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.table-header {
  display: flex;
  justify-content: space-between;
  padding: 14px 20px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.table-row:hover {
  background: rgba(63, 197, 183, 0.03);
}

.bunway-code {
  color: #3fc5b7;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 14px;
}

.express-pkg {
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

.table-footer {
  padding: 14px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  text-align: center;
}

.table-footer a {
  color: #3fc5b7;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
}

.table-footer a:hover {
  text-decoration: underline;
}

/* Code example */
.code-example {
  max-width: 580px;
  margin: 0 auto 40px;
  background: #0c0c0c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  text-align: left;
}

.code-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.code-header .dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.code-header .dot.red { background: #ff5f57; }
.code-header .dot.yellow { background: #febc2e; }
.code-header .dot.green { background: #28c840; }

.code-header .filename {
  margin-left: auto;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-family: var(--vp-font-family-mono);
}

.code-block {
  margin: 0;
  padding: 20px;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 13px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.85);
  overflow-x: auto;
}

.code-block .kw { color: #c678dd; }
.code-block .str { color: #98c379; }
.code-block .fn { color: #61afef; }
.code-block .num { color: #d19a66; }

/* CTAs */
.cta-row {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.cta-primary,
.cta-secondary {
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 24px;
  border-radius: 8px;
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

/* Footer */
.landing-footer {
  position: relative;
  z-index: 3;
  padding: 40px 24px;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.landing-footer p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.35);
  margin: 0 0 12px;
}

.landing-footer a {
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
}

.landing-footer a:hover {
  color: #3fc5b7;
}

.footer-links {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.footer-links a {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.35);
}

@media (max-width: 640px) {
  .seo-section {
    padding: 60px 16px;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .cta-row {
    flex-direction: column;
    align-items: center;
  }

  .cta-primary,
  .cta-secondary {
    width: 100%;
    max-width: 280px;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .orb {
    animation: none;
  }
}
</style>
