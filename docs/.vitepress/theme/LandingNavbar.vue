<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const scrolled = ref(false)

const handleScroll = () => { scrolled.value = window.scrollY > 24 }

onMounted(() => window.addEventListener('scroll', handleScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', handleScroll))
</script>

<template>
  <nav class="nav" :class="{ scrolled }">
    <a href="/" class="logo">bunWay</a>

    <div class="nav-links">
      <a href="/guide/getting-started" class="nav-link">Docs</a>
      <a href="/middleware/index" class="nav-link">Middleware</a>
      <a
        href="https://github.com/JointOps/bunway/releases"
        target="_blank"
        rel="noopener"
        class="nav-link"
      >Changelog</a>
    </div>

    <div class="nav-right">
      <div class="socials">
        <a href="https://x.com/JointOps_" target="_blank" rel="noopener" class="icon-link" aria-label="Twitter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </a>
        <a href="https://github.com/JointOps/bunway" target="_blank" rel="noopener" class="icon-link" aria-label="GitHub">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
        <a href="https://discord.gg/fTF4qjaMFT" target="_blank" rel="noopener" class="icon-link" aria-label="Discord">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
          </svg>
        </a>
      </div>

      <a href="/guide/getting-started" class="cta">
        Get Started
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </a>
    </div>
  </nav>
</template>

<style scoped>
.nav {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 52px;
  width: calc(100% - 48px);
  max-width: 1040px;
  background: rgba(7, 8, 9, 0.55);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--r-lg);
  transition: background var(--dur-base) ease, border-color var(--dur-base) ease,
              box-shadow var(--dur-base) ease;
}

.nav.scrolled {
  background: rgba(7, 8, 9, 0.82);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.logo {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  text-decoration: none;
  letter-spacing: var(--ls-snug);
  flex-shrink: 0;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 2px;
}

.nav-link {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-3);
  text-decoration: none;
  padding: 6px 12px;
  border-radius: var(--r-sm);
  letter-spacing: var(--ls-wide);
  transition: color var(--dur-fast) ease, background var(--dur-fast) ease;
}

.nav-link:hover {
  color: var(--text-1);
  background: rgba(255, 255, 255, 0.06);
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.socials {
  display: flex;
  align-items: center;
  gap: 2px;
}

.icon-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--r-sm);
  color: var(--text-4);
  transition: color var(--dur-fast) ease, background var(--dur-fast) ease;
}

.icon-link:hover {
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.06);
}

.cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: var(--ls-wide);
  color: #000;
  background: #fff;
  border-radius: var(--r-sm);
  text-decoration: none;
  transition: background var(--dur-fast) ease, transform var(--dur-fast) ease,
              box-shadow var(--dur-fast) ease;
}

.cta:hover {
  background: rgba(255, 255, 255, 0.88);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.cta svg {
  transition: transform var(--dur-fast) ease;
}

.cta:hover svg {
  transform: translateX(2px);
}

@media (max-width: 768px) {
  .nav-links { display: none; }
}

@media (max-width: 640px) {
  .nav {
    width: calc(100% - 32px);
    padding: 0 14px;
    top: 10px;
  }
  .socials { display: none; }
}
</style>
