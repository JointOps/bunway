<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { computed } from 'vue'
import LandingNavbar from './LandingNavbar.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()

const isHome = computed(() => frontmatter.value.layout === 'home')
</script>

<template>
  <div :class="{ 'landing-page': isHome }">
    <LandingNavbar v-if="isHome" />
    <Layout>
      <template #home-hero-info-before>
        <a href="https://github.com/JointOps/bunway/releases" class="version-badge" target="_blank" rel="noopener">
          <span class="version-dot"></span>
          <span>v1.0.0 is here!</span>
          <span class="chevron">→</span>
        </a>
      </template>
    </Layout>
  </div>
</template>

<style scoped>
.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 100px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  transition: all 0.2s ease;
  margin-bottom: 1px;
}

.version-badge:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(63, 197, 183, 0.4);
  color: #fff;
}

.version-dot {
  width: 6px;
  height: 6px;
  background: #22c55e;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.chevron {
  opacity: 0.4;
  font-size: 11px;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.version-badge:hover .chevron {
  opacity: 0.7;
  transform: translateX(2px);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
