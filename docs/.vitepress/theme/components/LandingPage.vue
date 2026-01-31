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

    <!-- Content -->
    <HeroSection />
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

@media (prefers-reduced-motion: reduce) {
  .orb {
    animation: none;
  }
}
</style>
