<script setup>
import { ref } from 'vue'

const mobileMenuOpen = ref(false)

const navLinks = [
  { text: 'Docs', link: '/guide/getting-started' },
  { text: 'Quick Start', link: '/guide/overview' },
  { text: 'Middleware', link: '/middleware/index' },
  { text: 'Migration', link: '/guide/express-migration' },
]

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}
</script>

<template>
  <nav class="landing-nav">
    <div class="nav-container">
      <a href="/" class="nav-logo">
        <span class="logo-text">bunWay</span>
      </a>

      <div class="nav-links" :class="{ 'mobile-open': mobileMenuOpen }">
        <a
          v-for="link in navLinks"
          :key="link.text"
          :href="link.link"
          class="nav-link"
          @click="mobileMenuOpen = false"
        >
          {{ link.text }}
        </a>
      </div>

      <div class="nav-actions">
        <a href="https://github.com/JointOps/bunway" class="nav-icon" target="_blank" rel="noopener" aria-label="GitHub">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
        <a href="https://www.npmjs.com/package/bunway" class="nav-icon" target="_blank" rel="noopener" aria-label="npm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 0v24h24V0H0zm19.2 19.2H12v-9.6H7.2v9.6H4.8V4.8h14.4v14.4z"/>
          </svg>
        </a>
        <a href="/guide/getting-started" class="nav-cta">
          Get Started
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14"/>
            <path d="m12 5 7 7-7 7"/>
          </svg>
        </a>
      </div>

      <button class="mobile-menu-btn" @click="toggleMobileMenu" :aria-expanded="mobileMenuOpen" aria-label="Toggle menu">
        <span class="hamburger" :class="{ 'open': mobileMenuOpen }">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.landing-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.nav-container {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-logo {
  display: flex;
  align-items: center;
  text-decoration: none;
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 32px;
}

.nav-link {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  transition: color 0.2s ease;
  position: relative;
}

.nav-link:hover {
  color: #fff;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(135deg, #3fc5b7, #22d3ee);
  transform: scaleX(0);
  transition: transform 0.2s ease;
}

.nav-link:hover::after {
  transform: scaleX(1);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.2s ease;
}

.nav-icon:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.nav-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  color: #0a0a0a;
  background: linear-gradient(135deg, #3fc5b7, #22d3ee);
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.nav-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(63, 197, 183, 0.4);
}

.nav-cta svg {
  transition: transform 0.2s ease;
}

.nav-cta:hover svg {
  transform: translateX(2px);
}

.mobile-menu-btn {
  display: none;
  padding: 8px;
  background: none;
  border: none;
  cursor: pointer;
}

.hamburger {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 20px;
}

.hamburger span {
  display: block;
  height: 2px;
  background: #fff;
  border-radius: 2px;
  transition: all 0.3s ease;
}

.hamburger.open span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.hamburger.open span:nth-child(2) {
  opacity: 0;
}

.hamburger.open span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

@media (max-width: 768px) {
  .nav-links {
    position: fixed;
    top: 64px;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(12px);
    flex-direction: column;
    padding: 24px;
    gap: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s ease;
  }

  .nav-links.mobile-open {
    transform: translateY(0);
    opacity: 1;
    pointer-events: auto;
  }

  .nav-link {
    width: 100%;
    padding: 16px 0;
    font-size: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .nav-link::after {
    display: none;
  }

  .nav-actions {
    gap: 12px;
  }

  .nav-cta {
    display: none;
  }

  .mobile-menu-btn {
    display: block;
  }
}
</style>
