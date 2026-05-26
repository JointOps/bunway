<!-- docs/.vitepress/theme/components/Badge.vue -->
<script setup lang="ts">
defineProps<{
  type?: "info" | "new" | "deprecated" | "beta" | "warning"
  text?: string
}>()
</script>

<template>
  <span class="bw-badge" :class="`bw-badge--${type ?? 'info'}`">
    <slot>{{ text }}</slot>
  </span>
</template>

<style scoped>
.bw-badge {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: var(--ls-wide);
  text-transform: uppercase;
  padding: 0.18em 0.6em;
  border-radius: 999px;
  border: 1px solid;
  line-height: 1.6;
  vertical-align: middle;
  position: relative;
  top: -1px;
  white-space: nowrap;
}

/* ── Variants ──────────────────────────────── */

.bw-badge--info {
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--border);
}

.bw-badge--new {
  color: var(--brand);
  background: var(--brand-8);
  border-color: var(--border-brand);
}

.bw-badge--deprecated {
  color: var(--red);
  background: var(--red-dim);
  border-color: var(--red-border);
}

.bw-badge--beta {
  color: var(--amber);
  background: var(--amber-dim);
  border-color: var(--amber-border);
}

.bw-badge--warning {
  color: var(--amber);
  background: var(--amber-dim);
  border-color: var(--amber-border);
}
</style>
