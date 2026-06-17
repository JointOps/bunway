import { onMounted, onUnmounted } from 'vue'

export function useAccordion() {
  /**
   * Capture-phase listener — fires before VitePress's @click.stop="toggle()"
   * on the caret button, so stopPropagation doesn't hide the event from us.
   * requestAnimationFrame defers the sibling-close until after Vue has
   * updated the open/closed state for the item that was actually clicked.
   */
  function handleClick(e: MouseEvent) {
    const target = e.target as Element

    // Was a collapsible sidebar item header clicked?
    const itemHeader = target.closest('.VPSidebarItem.has-children > .item')
    if (!itemHeader) return

    const sidebarItem = itemHeader.parentElement
    if (!sidebarItem) return

    const parent = sidebarItem.parentElement
    if (!parent) return

    requestAnimationFrame(() => {
      // The item was just closed — nothing to do
      if (sidebarItem.classList.contains('is-collapsed')) return

      // Item is now open — close every open sibling
      for (const sibling of Array.from(parent.children)) {
        if (
          sibling === sidebarItem ||
          !sibling.classList.contains('VPSidebarItem') ||
          !sibling.classList.contains('has-children') ||
          sibling.classList.contains('is-collapsed')
        ) continue

        sibling.querySelector<HTMLElement>('.caret')?.click()
      }
    })
  }

  onMounted(() => {
    // Capture phase = we see the event before stopPropagation can hide it
    document.addEventListener('click', handleClick, true)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClick, true)
  })
}
