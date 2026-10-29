// Smart multi-token fuzzy and relevance search utility
// Prioritizes exact matches, prefix matches, word boundaries, and field weights.
// Prevents false matches (e.g. searching "11 MDF" matching "1.7 MDF" via HSN code "44111300").

export type FieldGetter<T> = (item: T) => string | number | null | undefined | (string | number | null | undefined)[]

export interface SearchFieldMap<T> {
  /** High priority primary identifier (e.g. name, label, orderNumber, voucherNo, customerName) */
  primary?: FieldGetter<T>
  /** Secondary identifier (e.g. SKU, code, alias, company) */
  secondary?: FieldGetter<T>
  /** Descriptive / category metadata (e.g. category, subtitle, notes, place) */
  meta?: FieldGetter<T>
  /** Strict codes/numbers (e.g. HSN code, GSTIN, phone). Special handling: won't match short arbitrary substrings */
  code?: FieldGetter<T>
}

/** Check if sub occurs at a word boundary or digit/letter transition in text */
export function matchesWordBoundary(text: string, sub: string): boolean {
  if (!text || !sub) return false
  const idx = text.indexOf(sub)
  if (idx === -1) return false
  if (idx === 0) return true
  const prevChar = text.charAt(idx - 1)
  const firstSubChar = sub.charAt(0)
  
  // Standard delimiter boundary (space, punctuation, slash, hyphens)
  if (/[\s\-_\/.,()[\]:]/.test(prevChar)) return true
  
  // Digit <-> Letter transition (e.g. "11mm" or "8x4")
  const isDigitToLetter = (/\d/.test(prevChar) && /[a-z]/i.test(firstSubChar)) ||
                          (/[a-z]/i.test(prevChar) && /\d/.test(firstSubChar))
  return isDigitToLetter
}

/**
 * Computes a relevance score for an item against a search query.
 * Returns 0 if any required search token is completely missing from all searchable fields.
 */
export function scoreSearchItem<T>(item: T, query: string, fieldMap: SearchFieldMap<T>): number {
  if (!item) return 0
  const q = String(query || '').trim().toLowerCase()
  if (!q) return 1

  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 1

  const toArray = (v: any) => Array.isArray(v) ? v : [v]
  const cleanText = (s: any) => String(s ?? '').trim().toLowerCase()
  const cleanList = (getter?: FieldGetter<T>) => {
    if (!getter) return []
    try {
      return toArray(getter(item)).map(cleanText).filter(Boolean)
    } catch {
      return []
    }
  }

  const primaries = cleanList(fieldMap.primary)
  const secondaries = cleanList(fieldMap.secondary)
  const metas = cleanList(fieldMap.meta)
  const codes = cleanList(fieldMap.code)

  let score = 0

  // 1. Full Query Exact Match Boost (Highest Priority)
  if (primaries.some(p => p === q)) {
    score += 100000
  } else if (secondaries.some(s => s === q)) {
    score += 80000
  }

  // 2. Full Query Prefix Match Boost
  if (primaries.some(p => p.startsWith(q))) {
    score += 40000
  } else if (secondaries.some(s => s.startsWith(q))) {
    score += 25000
  }

  // 3. Full Query Word-Boundary Match
  if (primaries.some(p => matchesWordBoundary(p, q))) {
    score += 20000
  } else if (secondaries.some(s => matchesWordBoundary(s, q))) {
    score += 12000
  } else if (primaries.some(p => p.includes(q))) {
    score += 8000
  }

  let allTokensInPrimary = true
  let lastPrimaryIdx = -1
  let inOrderInPrimary = true

  // 4. Token-by-Token Match Evaluation
  for (const t of tokens) {
    let tokenScore = 0
    let matchedInPrimary = false

    // Check Primary fields (e.g. Name, Label)
    for (const p of primaries) {
      const words = p.split(/[\s\-_\/.,()[\]:]+/).filter(Boolean)
      const tIdx = p.indexOf(t)
      if (words.includes(t)) {
        tokenScore = Math.max(tokenScore, 3000)
        matchedInPrimary = true
      } else if (matchesWordBoundary(p, t)) {
        tokenScore = Math.max(tokenScore, 1800)
        matchedInPrimary = true
      } else if (tIdx !== -1) {
        tokenScore = Math.max(tokenScore, 800)
        matchedInPrimary = true
      }
      if (tIdx !== -1) {
        if (tIdx < lastPrimaryIdx) inOrderInPrimary = false
        lastPrimaryIdx = tIdx
      }
    }

    // Check Secondary fields (e.g. SKU, Company)
    if (!matchedInPrimary) {
      allTokensInPrimary = false
      for (const s of secondaries) {
        const words = s.split(/[\s\-_\/.,()[\]:]+/).filter(Boolean)
        if (words.includes(t)) {
          tokenScore = Math.max(tokenScore, 2000)
        } else if (matchesWordBoundary(s, t)) {
          tokenScore = Math.max(tokenScore, 1200)
        } else if (s.includes(t)) {
          tokenScore = Math.max(tokenScore, 400)
        }
      }

      // Check Meta fields (e.g. Category, Subtitle)
      for (const m of metas) {
        const words = m.split(/[\s\-_\/.,()[\]:]+/).filter(Boolean)
        if (words.includes(t)) {
          tokenScore = Math.max(tokenScore, 500)
        } else if (matchesWordBoundary(m, t)) {
          tokenScore = Math.max(tokenScore, 300)
        } else if (m.includes(t)) {
          tokenScore = Math.max(tokenScore, 100)
        }
      }

      // Check Code fields (e.g. HSN Code, Phone, GSTIN)
      // Guard: Short tokens (< 4 digits) must NOT match arbitrary middle substrings of numeric codes
      for (const c of codes) {
        if (t.length < 4) {
          if (c === t) {
            tokenScore = Math.max(tokenScore, 3000)
          } else if (c.startsWith(t)) {
            tokenScore = Math.max(tokenScore, 1500)
          }
        } else {
          if (c === t) {
            tokenScore = Math.max(tokenScore, 3000)
          } else if (c.startsWith(t)) {
            tokenScore = Math.max(tokenScore, 1500)
          } else if (c.includes(t)) {
            tokenScore = Math.max(tokenScore, 100)
          }
        }
      }
    }

    // If this token was NOT matched in ANY field, the entire item fails the search
    if (tokenScore === 0) {
      return 0
    }
    score += tokenScore
  }

  // 5. Multi-token Synergy Bonuses
  if (allTokensInPrimary) score += 6000
  if (allTokensInPrimary && inOrderInPrimary) score += 4000

  // 6. Length Proximity Bonus (Shorter primary text matching query is more specific)
  const primaryLen = primaries[0] ? primaries[0].length : 100
  const lenDiff = Math.max(0, primaryLen - q.length)
  score += Math.max(0, 500 - lenDiff * 4)

  return score
}

/**
 * Filters and ranks an array of items by search relevance.
 * When query is empty or whitespace, returns the original array untouched.
 */
export function rankAndFilter<T>(items: T[], query: string, fieldMap: SearchFieldMap<T>): T[] {
  if (!Array.isArray(items) || items.length === 0) return []
  const q = String(query || '').trim()
  if (!q) return items

  const scored: { item: T; score: number; primaryText: string }[] = []
  const toArray = (v: any) => Array.isArray(v) ? v : [v]

  for (const item of items) {
    const score = scoreSearchItem(item, q, fieldMap)
    if (score > 0) {
      let primaryText = ''
      if (fieldMap.primary) {
        try {
          const val = fieldMap.primary(item)
          primaryText = String(toArray(val)[0] ?? '')
        } catch {
          primaryText = ''
        }
      }
      scored.push({ item, score, primaryText })
    }
  }

  scored.sort((a, b) => {
    // 1. Sort by relevance score descending
    if (b.score !== a.score) return b.score - a.score
    // 2. Tie-break: shorter primary string first (closer match)
    if (a.primaryText.length !== b.primaryText.length) {
      return a.primaryText.length - b.primaryText.length
    }
    // 3. Tie-break: alphabetical order
    return a.primaryText.localeCompare(b.primaryText)
  })

  return scored.map(s => s.item)
}

/**
 * Preconfigured helper to filter and rank catalog/inventory products.
 */
export function rankProducts<T extends { name?: string; sku?: string; hsnCode?: string; category?: { name?: string }; categoryId?: string }>(
  products: T[],
  query: string,
  getCategoryName?: (catId?: string) => string
): T[] {
  return rankAndFilter(products, query, {
    primary: p => p.name,
    secondary: p => p.sku,
    meta: p => p.category?.name || (getCategoryName && p.categoryId ? getCategoryName(p.categoryId) : ''),
    code: p => p.hsnCode
  })
}

/**
 * Preconfigured helper to filter and rank CustomSelect dropdown options.
 */
export function rankSelectOptions<T extends { label: string; value: any; subtitle?: string }>(
  options: T[],
  query: string
): T[] {
  return rankAndFilter(options, query, {
    primary: o => o.label,
    secondary: o => o.subtitle,
    // Extract HSN code or numeric codes from subtitle if present
    code: o => {
      if (!o.subtitle) return null
      const hsnMatch = o.subtitle.match(/HSN:\s*(\d+)/i)
      return hsnMatch ? hsnMatch[1] : null
    }
  })
}
