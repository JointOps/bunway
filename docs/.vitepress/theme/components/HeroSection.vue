<script setup>
import { ref, onMounted } from 'vue'

const show = ref(false)
const copied = ref(false)

const installCmd = 'bun add bunway'

onMounted(() => {
  setTimeout(() => { show.value = true }, 100)
})

const copyInstall = async () => {
  await navigator.clipboard.writeText(installCmd)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <section class="hero" :class="{ show }">
    <!-- Left column: value proposition -->
    <div class="hero-left">
      <!-- Version badge -->
      <a
        href="https://github.com/JointOps/bunway/releases"
        target="_blank"
        class="badge"
      >
        <span class="pulse"></span>
        v1.0.8 — 24 built-in middleware
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </a>

      <!-- Headline -->
      <h1 class="headline">
        <span class="line1">Express API.</span>
        <span class="line2">Bun speed.</span>
      </h1>

      <!-- Subheadline -->
      <p class="sub">
        Drop-in replacement. One import replaces 15+ npm packages.<br>
        Same <code>(req, res, next)</code>. Zero rewrites.
      </p>

      <!-- Stats strip -->
      <div class="stats-strip">
        <div class="stat-divider"></div>
        <div class="stat">
          <span class="stat-value">0</span>
          <span class="stat-label">dependencies</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat">
          <span class="stat-value">24</span>
          <span class="stat-label">built-in middleware</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat">
          <span class="stat-value">97%+</span>
          <span class="stat-label">Express compat</span>
        </div>
      </div>

      <!-- Install command -->
      <button class="install" @click="copyInstall">
        <span class="prompt">$</span>
        <span class="cmd">{{ installCmd }}</span>
        <span class="copy-icon" :class="{ copied }">
          <svg v-if="!copied" width="16" height="16" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
      </button>

      <!-- CTAs -->
      <div class="actions">
        <a href="/guide/getting-started" class="btn primary">
          Get Started
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </a>
        <a href="https://github.com/JointOps/bunway" target="_blank" class="btn secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          View on GitHub
        </a>
      </div>
    </div>

    <!-- Right column: code window -->
    <div class="hero-right">
      <div class="code-window">
        <div class="window-chrome">
          <span class="dot red"></span>
          <span class="dot yellow"></span>
          <span class="dot green"></span>
          <span class="window-filename">app.ts</span>
          <span class="window-badge">bunWay</span>
        </div>
        <pre class="code-body"><code
><span class="kw">import</span> { bunway, cors, helmet, json, session } <span class="kw">from</span> <span class="str">'bunway'</span>

<span class="kw">const</span> app = <span class="fn">bunway</span>()

app.<span class="fn">use</span>(<span class="fn">cors</span>({ origin: <span class="kw">true</span> }))
app.<span class="fn">use</span>(<span class="fn">helmet</span>())
app.<span class="fn">use</span>(<span class="fn">json</span>())
app.<span class="fn">use</span>(<span class="fn">session</span>({ secret: <span class="str">'keyboard cat'</span> }))

app.<span class="fn">get</span>(<span class="str">'/users/:id'</span>, (req, res) => {
  res.<span class="fn">json</span>({ id: req.params.id })
})

app.<span class="fn">post</span>(<span class="str">'/users'</span>, <span class="fn">validate</span>({
  body: { email: { required: <span class="kw">true</span>, type: <span class="str">'email'</span> } }
}), createUser)

app.<span class="fn">listen</span>(<span class="num">3000</span>)
<span class="comment">// That's it. No npm install. No config.</span></code></pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ─── Layout ─────────────────────────────────────────── */

.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 64px;
  padding: 120px 48px 80px;
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.hero-left {
  flex: 1;
  max-width: 520px;
  opacity: 0;
  transform: translateY(24px);
  transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.hero.show .hero-left {
  opacity: 1;
  transform: translateY(0);
}

.hero-right {
  flex: 1;
  max-width: 520px;
  opacity: 0;
  transform: translateY(24px);
  transition: all 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.15s;
}

.hero.show .hero-right {
  opacity: 1;
  transform: translateY(0);
}

/* ─── Badge ───────────────────────────────────────────── */

.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 100px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  margin-bottom: 28px;
  transition: all 0.2s;
}

.badge:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(63, 197, 183, 0.3);
  color: #fff;
}

.pulse {
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.9); }
}

/* ─── Headline ────────────────────────────────────────── */

.headline {
  font-size: clamp(44px, 6vw, 68px);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.05;
  margin: 0 0 20px;
}

.line1 {
  display: block;
  color: #fff;
}

.line2 {
  display: block;
  background: linear-gradient(135deg, #3fc5b7 0%, #22d3ee 50%, #818cf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ─── Subheadline ─────────────────────────────────────── */

.sub {
  font-size: 17px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 32px;
  line-height: 1.7;
}

.sub code {
  color: #3fc5b7;
  background: rgba(63, 197, 183, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
  font-family: 'JetBrains Mono', monospace;
}

/* ─── Stats strip ─────────────────────────────────────── */

.stats-strip {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 0 32px;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stat-value {
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  background: linear-gradient(135deg, #3fc5b7 0%, #22d3ee 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

/* ─── Install command ─────────────────────────────────── */

.install {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 14px;
  color: #fff;
  cursor: pointer;
  margin-bottom: 28px;
  transition: all 0.2s;
}

.install:hover {
  background: rgba(0, 0, 0, 0.5);
  border-color: rgba(63, 197, 183, 0.4);
  transform: translateY(-1px);
}

.prompt { color: #3fc5b7; font-weight: 600; }
.cmd { color: rgba(255, 255, 255, 0.9); }

.copy-icon {
  display: flex;
  color: rgba(255, 255, 255, 0.4);
  transition: color 0.2s;
  margin-left: 4px;
}

.copy-icon.copied { color: #22c55e; }
.install:hover .copy-icon:not(.copied) { color: rgba(255, 255, 255, 0.7); }

/* ─── CTA buttons ─────────────────────────────────────── */

.actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.btn {
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

.btn.primary {
  background: linear-gradient(135deg, #3fc5b7 0%, #22d3ee 100%);
  color: #000;
}

.btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(63, 197, 183, 0.35);
}

.btn.primary svg { transition: transform 0.2s; }
.btn.primary:hover svg { transform: translateX(3px); }

.btn.secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
}

.btn.secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

/* ─── Code window ─────────────────────────────────────── */

.code-window {
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(63, 197, 183, 0.04),
    0 32px 64px -16px rgba(0, 0, 0, 0.85),
    0 0 120px -30px rgba(63, 197, 183, 0.08);
  transition: box-shadow 0.3s ease, border-color 0.3s ease;
}

.code-window:hover {
  border-color: rgba(63, 197, 183, 0.15);
  box-shadow:
    0 0 0 1px rgba(63, 197, 183, 0.08),
    0 32px 64px -16px rgba(0, 0, 0, 0.9),
    0 0 120px -20px rgba(63, 197, 183, 0.15);
}

.window-chrome {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 13px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot.red    { background: #ff5f57; }
.dot.yellow { background: #febc2e; }
.dot.green  { background: #28c840; }

.window-filename {
  margin-left: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-family: 'JetBrains Mono', monospace;
}

.window-badge {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  color: #3fc5b7;
  background: rgba(63, 197, 183, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.02em;
}

.code-body {
  margin: 0;
  padding: 20px 24px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12.5px;
  line-height: 1.85;
  color: rgba(255, 255, 255, 0.72);
  overflow-x: auto;
  tab-size: 2;
}

.code-body .kw      { color: #c678dd; }
.code-body .str     { color: #98c379; }
.code-body .fn      { color: #61afef; }
.code-body .num     { color: #d19a66; }
.code-body .comment { color: rgba(255, 255, 255, 0.25); font-style: italic; }

/* ─── Responsive ──────────────────────────────────────── */

@media (max-width: 960px) {
  .hero {
    flex-direction: column;
    gap: 48px;
    padding: 100px 24px 60px;
    text-align: center;
  }

  .hero-left,
  .hero-right {
    max-width: 100%;
    width: 100%;
  }

  .badge,
  .install {
    display: inline-flex;
  }

  .stats-strip,
  .actions {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .headline { font-size: 40px; }
  .sub      { font-size: 15px; }

  .stats-strip { gap: 12px; }
  .stat-value  { font-size: 18px; }

  .install {
    padding: 12px 16px;
    font-size: 12px;
    width: 100%;
    justify-content: space-between;
  }

  .actions {
    flex-direction: column;
    width: 100%;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-left,
  .hero-right,
  .pulse {
    animation: none;
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>
