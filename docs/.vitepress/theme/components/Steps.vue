<!-- docs/.vitepress/theme/components/Steps.vue -->
<script setup lang="ts"></script>

<template>
  <div class="bw-steps">
    <slot />
  </div>
</template>

<style scoped>
.bw-steps :deep(ol) {
  list-style: none;
  padding: 0;
  margin: var(--space-6) 0;
  counter-reset: steps-counter;
}

.bw-steps :deep(ol > li) {
  position: relative;
  padding-left: calc(var(--space-10) + var(--space-2));
  padding-bottom: var(--space-6);
  counter-increment: steps-counter;
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--text-2);
  line-height: var(--lh-relaxed);
}

/* Vertical connector line between steps */
.bw-steps :deep(ol > li:not(:last-child))::after {
  content: "";
  position: absolute;
  left: calc(var(--space-5) - 1px);
  top: calc(var(--space-10) + 4px);
  bottom: 0;
  width: 1px;
  background: var(--border);
}

/* Step number circle */
.bw-steps :deep(ol > li)::before {
  content: counter(steps-counter);
  position: absolute;
  left: 0;
  top: 2px;
  width: var(--space-10);
  height: var(--space-10);
  border-radius: 50%;
  background: var(--brand-8);
  border: 1px solid var(--border-brand);
  color: var(--brand);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
}

/* Headings inside steps */
.bw-steps :deep(ol > li > p:first-child),
.bw-steps :deep(ol > li > h3:first-child),
.bw-steps :deep(ol > li > h4:first-child) {
  margin-top: 0 !important;
  font-weight: 600 !important;
  color: var(--text-1) !important;
}

/* Last step: no connector line padding */
.bw-steps :deep(ol > li:last-child) {
  padding-bottom: 0;
}
</style>
