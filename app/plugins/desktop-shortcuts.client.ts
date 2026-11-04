export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  /**
   * Helper to inspect DOM and retrieve all currently visible modal dialogs,
   * sorted from highest z-index (topmost) down to lowest.
   */
  const getOpenModals = () => {
    const closeButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-modal-close="true"]'))
    const modals: { container: HTMLElement; button: HTMLElement; zIndex: number }[] = []

    for (const btn of closeButtons) {
      // Find the closest fixed backdrop, dialog or modal container
      const container = (
        btn.closest('[role="dialog"]') ||
        btn.closest('.fixed.inset-0') ||
        btn.closest('[data-modal-card="true"]') ||
        btn.closest('[data-modal-container="true"]') ||
        btn.parentElement
      ) as HTMLElement | null

      if (!container) continue

      // Verify that the container is actually rendered and visible
      const style = window.getComputedStyle(container)
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        (container.offsetWidth === 0 && container.offsetHeight === 0 && !container.getClientRects().length)
      ) {
        continue
      }

      // Check if button itself is hidden or disabled
      const btnStyle = window.getComputedStyle(btn)
      if (btnStyle.display === 'none' || btnStyle.visibility === 'hidden' || (btn as HTMLButtonElement).disabled) {
        continue
      }

      // Compute effective z-index
      let z = parseInt(style.zIndex, 10)
      if (isNaN(z) || z === 0) {
        let cur: HTMLElement | null = container.parentElement
        while (cur && cur !== document.body) {
          const pz = parseInt(window.getComputedStyle(cur).zIndex, 10)
          if (!isNaN(pz) && pz > 0) {
            z = pz
            break
          }
          cur = cur.parentElement
        }
      }
      if (isNaN(z)) z = 100

      // Deduplicate by container (choose the first valid close button found)
      if (!modals.some(m => m.container === container)) {
        modals.push({ container, button: btn, zIndex: z })
      }
    }

    // Sort descending: highest zIndex first; tie-breaker: later in DOM tree
    modals.sort((a, b) => {
      if (b.zIndex !== a.zIndex) {
        return b.zIndex - a.zIndex
      }
      const pos = a.container.compareDocumentPosition(b.container)
      return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? 1 : -1
    })

    return modals
  }

  /**
   * Global Keydown Listener
   */
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    // -------------------------------------------------------------------------
    // 1. ESCAPE: Close topmost open modal or blur active search
    // -------------------------------------------------------------------------
    if (e.key === 'Escape') {
      // If a CustomSelect dropdown is currently open (z-[99999]), close it first
      const openSelectBackdrop = document.querySelector<HTMLElement>('.fixed.inset-0.z-\\[99998\\]')
      if (openSelectBackdrop) {
        openSelectBackdrop.click()
        e.preventDefault()
        e.stopPropagation()
        return
      }

      const modals = getOpenModals()
      if (modals.length > 0) {
        const topModal = modals[0]
        topModal.button.click()
        e.preventDefault()
        e.stopPropagation()
        return
      }

      // If no modal is open, and user has focused an input/search, blur it
      const activeEl = document.activeElement as HTMLElement | null
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        activeEl.blur()
        e.preventDefault()
        return
      }
    }

    // -------------------------------------------------------------------------
    // 2. QUICK SEARCH: Ctrl + K, Cmd + K, or "/"
    // -------------------------------------------------------------------------
    const isCtrlK = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')
    const isSlash = e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')

    if (isCtrlK || isSlash) {
      // If a modal is open, search within that modal first
      const modals = getOpenModals()
      let searchTarget: HTMLInputElement | null = null

      if (modals.length > 0) {
        searchTarget = modals[0].container.querySelector<HTMLInputElement>(
          '[data-autofocus="true"], [data-quick-search="true"], input[type="text"]:not([disabled])'
        )
      }

      // Otherwise look for page-level primary search
      if (!searchTarget) {
        searchTarget =
          document.querySelector<HTMLInputElement>('[data-quick-search="true"]') ||
          document.querySelector<HTMLInputElement>('input[placeholder*="Search" i]:not([disabled])') ||
          document.querySelector<HTMLInputElement>('input[type="text"]:not([disabled])')
      }

      if (searchTarget && searchTarget !== document.activeElement) {
        e.preventDefault()
        searchTarget.focus()
        if (typeof searchTarget.select === 'function') {
          searchTarget.select()
        }
      }
    }
  }, true) // Capture phase ensures timely interception

  /**
   * 3. AUTO-FOCUS ON MODAL MOUNT
   * Automatically focuses search/input when a modal appears
   */
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement
            const isModal =
              el.matches?.('.fixed.inset-0, [data-modal-card="true"], [role="dialog"]') ||
              Boolean(el.querySelector?.('[data-modal-close="true"]'))

            if (isModal) {
              setTimeout(() => {
                const target =
                  el.querySelector<HTMLElement>('[data-autofocus="true"]') ||
                  el.querySelector<HTMLInputElement>('[data-quick-search="true"]') ||
                  el.querySelector<HTMLInputElement>('input[type="text"]:not([disabled]):not([readonly])') ||
                  el.querySelector<HTMLInputElement>('input:not([disabled]):not([type="hidden"])')

                if (target && typeof target.focus === 'function' && document.activeElement !== target) {
                  target.focus()
                }
              }, 60)
            }
          }
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
  }
})
