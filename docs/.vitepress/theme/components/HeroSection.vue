<script setup>
import { ref, onMounted } from 'vue'

const show    = ref(false)
const copied  = ref(false)
const installCmd = 'bun add bunway'

onMounted(() => setTimeout(() => { show.value = true }, 80))

const copyInstall = async () => {
  await navigator.clipboard.writeText(installCmd)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <section class="hero" :class="{ show }">

    <!-- Left: value proposition -->
    <div class="hero-left">

      <!-- Version badge -->
      <a href="https://github.com/JointOps/bunway/releases" target="_blank" class="badge">
        <span class="pulse"></span>
        v1.0.8 — 24 built-in middleware
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5">
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

      <!-- Stats -->
      <div class="stats-strip">
        <div class="stat">
          <span class="stat-value">0</span>
          <span class="stat-label">dependencies</span>
        </div>
        <div class="stat">
          <span class="stat-value">24</span>
          <span class="stat-label">built-in middleware</span>
        </div>
        <div class="stat">
          <span class="stat-value">97%+</span>
          <span class="stat-label">Express compat</span>
        </div>
      </div>

      <!-- Install command -->
      <button class="install" @click="copyInstall" aria-label="Copy install command">
        <span class="prompt">$</span>
        <span class="cmd">{{ installCmd }}</span>
        <span class="copy-icon" :class="{ copied }">
          <svg v-if="!copied" width="14" height="14" viewBox="0 0 24 24"
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

      <!-- CTAs -->
      <div class="actions">
        <a href="/guide/getting-started" class="btn primary">
          Get Started
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </a>
        <a href="https://github.com/JointOps/bunway" target="_blank" class="btn secondary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub
        </a>
      </div>
    </div>

    <!-- Right: code window -->
    <div class="hero-right">
      <div class="code-window">

        <!-- Minimal chrome — file icon + filename, no macOS dots -->
        <div class="window-chrome">
          <div class="chrome-tab">
            <svg class="file-icon" width="12" height="12" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            app.ts
          </div>
          <span class="window-badge">bunWay</span>
        </div>

        <pre class="code-body"><code
><span class="kw">import</span> { bunway, cors, helmet, json, session } <span class="kw">from</span> <span class="str">'bunway'</span>

<span class="kw">const</span> app = <span class="fn">bunway</span>()

app.<span class="fn">use</span>(<span class="fn">cors</span>({ origin: <span class="kw">true</span> }))
app.<span class="fn">use</span>(<span class="fn">helmet</span>())
app.<span class="fn">use</span>(<span class="fn">json</span>())
app.<span class="fn">use</span>(<span class="fn">session</span>({ secret: <span class="str">'keyboard cat'</span> }))

app.<span class="fn">get</span>(<span class="str">'/users/:id'</span>, (req, res) =&gt; {
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
  max-width: 1160px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.hero-left {
  flex: 1;
  max-width: 520px;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity var(--dur-enter) var(--ease-out),
              transform var(--dur-enter) var(--ease-out);
}

.hero.show .hero-left {
  opacity: 1;
  transform: translateY(0);
}

.hero-right {
  flex: 1;
  max-width: 520px;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity var(--dur-enter) var(--ease-out) 0.12s,
              transform var(--dur-enter) var(--ease-out) 0.12s;
}

.hero.show .hero-right {
  opacity: 1;
  transform: translateY(0);
}

/* ─── Version badge ───────────────────────────────────── */

.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 7px 12px 7px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-3);
  text-decoration: none;
  margin-bottom: var(--space-8);
  transition: border-color var(--dur-fast) ease,
              color var(--dur-fast) ease,
              background var(--dur-fast) ease;
}

.badge:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--border-brand);
  color: var(--text-2);
}

.pulse {
  width: 7px;
  height: 7px;
  background: var(--green);
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse 2.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
  60%       { opacity: 0.8; box-shadow: 0 0 0 5px rgba(34, 197, 94, 0); }
}

/* ─── Headline ────────────────────────────────────────── */

.headline {
  font-family: var(--font-display);
  font-size: clamp(1.9rem, 5vw, var(--text-7xl));
  font-weight: 700;
  letter-spacing: var(--ls-tighter);
  line-height: var(--lh-tight);
  margin: 0 0 var(--space-6);
}

.line1 {
  display: block;
  color: var(--text-1);
}

.line2 {
  display: block;
  background: linear-gradient(135deg, #3fc5b7 0%, #38e8de 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ─── Subheadline ─────────────────────────────────────── */

.sub {
  font-family: var(--font-body);
  font-size: var(--text-lg);
  color: var(--text-2);
  margin: 0 0 var(--space-8);
  line-height: var(--lh-relaxed);
}

.sub code {
  font-family: var(--font-mono);
  color: var(--brand);
  background: var(--brand-8);
  border: 1px solid var(--brand-12);
  padding: 2px 6px;
  border-radius: var(--r-xs);
  font-size: 0.85em;
}

/* ─── Stats strip ─────────────────────────────────────── */

.stats-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 0 0 var(--space-8);
}

.stat {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
  transition: border-color 160ms ease,
              background 160ms ease,
              transform 160ms ease,
              box-shadow 160ms ease;
}

.stat::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(63, 197, 183, 0.5) 50%,
    transparent 100%
  );
}

.stat:hover {
  border-color: var(--border-brand);
  background: rgba(63, 197, 183, 0.04);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(63, 197, 183, 0.08), 0 2px 8px rgba(0, 0, 0, 0.4);
}

.stat-value {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;
  color: var(--brand);
  letter-spacing: -0.02em;
}

.stat-label {
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: 500;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

/* ─── Install command ─────────────────────────────────── */

.install {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  padding: 12px 18px;
  background: var(--bg-raised);
  border: 1px solid var(--border-mid);
  border-radius: var(--r-sm);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-1);
  cursor: pointer;
  margin-bottom: var(--space-8);
  transition: border-color var(--dur-fast) ease,
              background var(--dur-fast) ease,
              transform var(--dur-fast) ease;
}

.install:hover {
  border-color: var(--border-brand);
  background: var(--bg-overlay);
  transform: translateY(-1px);
}

.prompt { color: var(--brand); font-weight: 600; }
.cmd    { color: var(--text-2); }

.copy-icon {
  display: flex;
  color: var(--text-4);
  transition: color var(--dur-fast) ease;
  margin-left: var(--space-1);
}

.copy-icon.copied                    { color: var(--green); }
.install:hover .copy-icon:not(.copied) { color: var(--text-2); }

/* ─── CTA buttons ─────────────────────────────────────── */

.actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.btn {
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

.btn.primary {
  background: linear-gradient(135deg, #3fc5b7 0%, #38e8de 100%);
  color: #042420;
  font-weight: 700;
}

.btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-brand);
}

.btn.primary svg { transition: transform var(--dur-fast) ease; }
.btn.primary:hover svg { transform: translateX(3px); }

.btn.secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--text-2);
}

.btn.secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--border-mid);
  color: var(--text-1);
  transform: translateY(-1px);
}

/* ─── Code window ─────────────────────────────────────── */

.code-window {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg), 0 0 80px -30px rgba(63, 197, 183, 0.07);
  transition: border-color var(--dur-slow) ease,
              box-shadow var(--dur-slow) ease;
}

.code-window:hover {
  border-color: var(--border-brand);
  box-shadow: var(--shadow-lg),
              0 -1px 0 rgba(63, 197, 183, 0.2),
              inset 0 1px 0 rgba(63, 197, 183, 0.05),
              0 0 80px -20px rgba(63, 197, 183, 0.1);
}

.window-chrome {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 11px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--border);
}

.chrome-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-3);
}

.file-icon {
  flex-shrink: 0;
  color: var(--text-4);
}

.window-badge {
  margin-left: auto;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--brand);
  background: var(--brand-8);
  border: 1px solid var(--brand-12);
  padding: 2px 8px;
  border-radius: var(--r-xs);
  letter-spacing: var(--ls-wide);
}

.code-body {
  margin: 0;
  padding: 20px var(--space-6);
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: var(--lh-loose);
  color: var(--text-code);
  overflow-x: auto;
  tab-size: 2;
}

.kw      { color: var(--syn-kw); }
.str     { color: var(--syn-str); }
.fn      { color: var(--syn-fn); }
.num     { color: var(--syn-num); }
.comment { color: var(--syn-comment); font-style: italic; }

/* ─── Responsive ──────────────────────────────────────── */

@media (max-width: 960px) {
  .hero {
    flex-direction: column;
    gap: var(--space-12);
    padding: 108px 24px 64px;
    text-align: center;
  }

  .hero-left, .hero-right {
    max-width: 100%;
    width: 100%;
  }

  .stats-strip { grid-template-columns: repeat(3, 1fr); }
  .actions     { justify-content: center; }
}

@media (max-width: 480px) {
  .headline   { font-size: 2rem; }
  .sub        { font-size: var(--text-base); }
  .stat-value { font-size: 1.4rem; }
  .stat       { padding: 14px 16px; }

  .install {
    padding: 10px 14px;
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
</style>
