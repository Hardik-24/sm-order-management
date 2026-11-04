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

    // -------------------------------------------------------------------------
    // 3. TAB FOCUS TRAP: Keep tab navigation trapped predictably inside open modal
    // -------------------------------------------------------------------------
    if (e.key === 'Tab') {
      const modals = getOpenModals()
      if (modals.length > 0) {
        const topModal = modals[0]

        // Find all visible, focusable elements inside the top-most modal
        const focusableSelector = [
          'a[href]',
          'button:not([disabled]):not([tabindex="-1"])',
          'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
          'select:not([disabled]):not([tabindex="-1"])',
          'textarea:not([disabled]):not([tabindex="-1"])',
          '[tabindex="0"]'
        ].join(', ')

        const focusables = Array.from(topModal.container.querySelectorAll<HTMLElement>(focusableSelector))
          .filter(el => {
            const style = window.getComputedStyle(el)
            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0)
            )
          })

        if (focusables.length > 0) {
          const first = focusables[0]
          const last = focusables[focusables.length - 1]
          const active = document.activeElement as HTMLElement | null

          if (e.shiftKey) {
            // Shift + Tab: if on first element or outside modal, loop to last
            if (active === first || !topModal.container.contains(active)) {
              e.preventDefault()
              last.focus()
              last.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
            }
          } else {
            // Tab: if on last element or outside modal, loop to first
            if (active === last || !topModal.container.contains(active)) {
              e.preventDefault()
              first.focus()
              first.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
            }
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // 4. ENTER KEY ADVANCE IN FORMS & DATA TABLES
    // -------------------------------------------------------------------------
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const active = document.activeElement as HTMLInputElement | null
      if (
        active &&
        active.tagName === 'INPUT' &&
        ['text', 'number', 'tel', 'email'].includes(active.type) &&
        !active.hasAttribute('data-quick-search') &&
        !active.getAttribute('placeholder')?.toLowerCase().includes('search')
      ) {
        const formContainer = active.closest('form, table, tbody, [data-form-container="true"], .space-y-6, .space-y-4')
        if (formContainer) {
          const inputSelector = [
            'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
            'select:not([disabled]):not([tabindex="-1"])',
            'textarea:not([disabled]):not([tabindex="-1"])'
          ].join(', ')

          const inputs = Array.from(formContainer.querySelectorAll<HTMLElement>(inputSelector))
            .filter(el => {
              const style = window.getComputedStyle(el)
              return style.display !== 'none' && style.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0)
            })

          const idx = inputs.indexOf(active)
          if (idx !== -1 && idx < inputs.length - 1) {
            e.preventDefault()
            const next = inputs[idx + 1]
            next.focus()
            if (next.tagName === 'INPUT') {
              (next as HTMLInputElement).select?.()
            }
            next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
          }
        }
      }
    }
  }, true) // Capture phase ensures timely interception

  /**
   * 5. AUTO-FOCUS ON MODAL MOUNT
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

  /**
   * 6. AUTO-SCROLL FOCUSED ELEMENTS
   * Smoothly ensures active input is visible within any scroll container
   */
  window.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement | null
    if (target && typeof target.scrollIntoView === 'function' && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
      setTimeout(() => {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }, 50)
    }
  }, true)
})
