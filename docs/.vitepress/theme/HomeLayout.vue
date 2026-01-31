<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { computed } from 'vue'
import LandingNavbar from './LandingNavbar.vue'
import LandingPage from './components/LandingPage.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()

const isHome = computed(() => frontmatter.value.layout === 'home')
</script>

<template>
  <div :class="{ 'landing-wrapper': isHome }">
    <!-- Custom Landing Page -->
    <template v-if="isHome">
      <LandingNavbar />
      <LandingPage />
    </template>

    <!-- Default VitePress Layout for docs -->
    <Layout v-else />
  </div>
</template>

<style scoped>
.landing-wrapper {
  min-height: 100vh;
  background: #050505;
}
</style>
