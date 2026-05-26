<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'

const props = defineProps<{ title: string }>()

const openTitle = inject<Ref<string | null>>('accordion:open')
const toggle    = inject<(t: string) => void>('accordion:toggle')

const isOpen = computed(() => openTitle?.value === props.title)

function handleClick(e: MouseEvent) {
  e.preventDefault()
  toggle?.(props.title)
}
</script>

<template>
  <details :open="isOpen" class="custom-block details">
    <summary @click="handleClick">{{ title }}</summary>
    <slot />
  </details>
</template>
