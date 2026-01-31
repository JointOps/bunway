<script setup>
import { ref, onMounted } from 'vue'

const show = ref(false)
const copied = ref(false)

const installCmd = 'bun add bunway'

onMounted(() => {
  setTimeout(() => {
    show.value = true
  }, 100)
})

const copyInstall = async () => {
  await navigator.clipboard.writeText(installCmd)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <section class="hero" :class="{ show }">
    <div class="content">
      <!-- Badge -->
      <a href="https://github.com/JointOps/bunway/releases" target="_blank" class="badge">
        <span class="pulse"></span>
        v1.0 is here
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
        Drop-in Express replacement. Zero rewrites. Just faster.
      </p>

      <!-- Install Command -->
      <button class="install" @click="copyInstall">
        <span class="prompt">$</span>
        <span class="cmd">{{ installCmd }}</span>
        <span class="copy-icon" :class="{ copied }">
          <svg v-if="!copied" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
      </button>

      <!-- CTAs -->
      <div class="actions">
        <a href="/guide/getting-started" class="btn primary">
          Get Started
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
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
  </section>
</template>

<style scoped>
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  position: relative;
  z-index: 1;
}

.content {
  max-width: 680px;
  text-align: center;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.hero.show .content {
  opacity: 1;
  transform: translateY(0);
}

/* Badge */
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
  margin-bottom: 32px;
  transition: all 0.2s;
}

.badge:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(99, 226, 183, 0.3);
  color: #fff;
}

.pulse {
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.9); }
}

/* Headline */
.headline {
  font-size: clamp(48px, 10vw, 72px);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1.05;
  margin: 0 0 24px;
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

/* Subheadline */
.sub {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 40px;
  line-height: 1.6;
}

/* Install Command */
.install {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 15px;
  color: #fff;
  cursor: pointer;
  margin-bottom: 40px;
  transition: all 0.2s;
}

.install:hover {
  background: rgba(0, 0, 0, 0.5);
  border-color: rgba(63, 197, 183, 0.4);
  transform: translateY(-2px);
}

.prompt {
  color: #3fc5b7;
  font-weight: 600;
}

.cmd {
  color: rgba(255, 255, 255, 0.9);
}

.copy-icon {
  display: flex;
  color: rgba(255, 255, 255, 0.4);
  transition: color 0.2s;
}

.copy-icon.copied {
  color: #22c55e;
}

.install:hover .copy-icon:not(.copied) {
  color: rgba(255, 255, 255, 0.7);
}

/* Actions */
.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 28px;
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

.btn.primary svg {
  transition: transform 0.2s;
}

.btn.primary:hover svg {
  transform: translateX(3px);
}

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

@media (max-width: 640px) {
  .headline {
    font-size: 40px;
  }

  .sub {
    font-size: 16px;
  }

  .install {
    padding: 14px 20px;
    font-size: 13px;
  }

  .actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .content {
    opacity: 1;
    transform: none;
    transition: none;
  }

  .pulse {
    animation: none;
  }
}
</style>
