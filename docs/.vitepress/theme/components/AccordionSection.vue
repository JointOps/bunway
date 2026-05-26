<script setup lang="ts">
import { ref, provide } from 'vue'

const openTitle = ref<string | null>(null)

provide('accordion:open', openTitle)
provide('accordion:toggle', (title: string) => {
  openTitle.value = openTitle.value === title ? null : title
})
</script>

<template>
  <div class="api-accordion">
    <slot />
  </div>
</template>
