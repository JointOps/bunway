// docs/.vitepress/theme/composables/useScrollReveal.ts
import { onMounted, onUnmounted, type Ref } from "vue"

export function useScrollReveal(
  elements: Ref<HTMLElement[]>,
  options: IntersectionObserverInit = {}
): void {
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed")
            observer?.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -64px 0px",
        ...options,
      }
    )

    elements.value.forEach((el) => observer?.observe(el))
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
  })
}
