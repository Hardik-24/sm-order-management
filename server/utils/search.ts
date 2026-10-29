// Server-side multi-token search and ranking utilities for Prisma and API endpoints

export function buildMultiTokenPrismaOr(
  query: string,
  fieldMappers: ((term: string) => any)[]
): any {
  const q = String(query || '').trim()
  if (!q) return undefined

  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return undefined

  // Every token must match in at least one of the fields (AND across tokens, OR across fields)
  return {
    AND: tokens.map(token => ({
      OR: fieldMappers.map(mapFn => mapFn(token))
    }))
  }
}

export function matchesWordBoundary(text: string, sub: string): boolean {
  if (!text || !sub) return false
  const idx = text.indexOf(sub)
  if (idx === -1) return false
  if (idx === 0) return true
  const prevChar = text.charAt(idx - 1)
  const firstSubChar = sub.charAt(0)
  
  if (/[\s\-_\/.,()[\]:]/.test(prevChar)) return true
  const isDigitToLetter = (/\d/.test(prevChar) && /[a-z]/i.test(firstSubChar)) ||
                          (/[a-z]/i.test(prevChar) && /\d/.test(firstSubChar))
  return isDigitToLetter
}

export function rankServerItems<T>(
  items: T[],
  query: string,
  fieldMap: {
    primary?: (item: T) => string | null | undefined
    secondary?: (item: T) => string | null | undefined
    meta?: (item: T) => string | null | undefined
    code?: (item: T) => string | null | undefined
  }
): T[] {
  const q = String(query || '').trim().toLowerCase()
  if (!q || !Array.isArray(items) || items.length === 0) return items

  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return items

  const scored: { item: T; score: number; primaryText: string }[] = []

  for (const item of items) {
    const primary = String(fieldMap.primary ? fieldMap.primary(item) || '' : '').toLowerCase().trim()
    const secondary = String(fieldMap.secondary ? fieldMap.secondary(item) || '' : '').toLowerCase().trim()
    const meta = String(fieldMap.meta ? fieldMap.meta(item) || '' : '').toLowerCase().trim()
    const code = String(fieldMap.code ? fieldMap.code(item) || '' : '').toLowerCase().trim()

    let score = 0

    // Exact match
    if (primary === q) score += 100000
    else if (secondary === q) score += 80000

    // Prefix match
    if (primary.startsWith(q)) score += 40000
    else if (secondary.startsWith(q)) score += 25000

    // Word boundary full query
    if (matchesWordBoundary(primary, q)) score += 20000
    else if (matchesWordBoundary(secondary, q)) score += 12000
    else if (primary.includes(q)) score += 8000

    let allTokensInPrimary = true
    let lastPrimaryIdx = -1
    let inOrderInPrimary = true

    for (const t of tokens) {
      let tokenScore = 0
      let matchedInPrimary = false

      const words = primary.split(/[\s\-_\/.,()[\]:]+/).filter(Boolean)
      const tIdx = primary.indexOf(t)
      if (words.includes(t)) {
        tokenScore = Math.max(tokenScore, 3000)
        matchedInPrimary = true
      } else if (matchesWordBoundary(primary, t)) {
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

      if (!matchedInPrimary) {
        allTokensInPrimary = false
        const sWords = secondary.split(/[\s\-_\/.,()[\]:]+/).filter(Boolean)
        if (sWords.includes(t)) tokenScore = Math.max(tokenScore, 2000)
        else if (matchesWordBoundary(secondary, t)) tokenScore = Math.max(tokenScore, 1200)
        else if (secondary.includes(t)) tokenScore = Math.max(tokenScore, 400)

        const mWords = meta.split(/[\s\-_\/.,()[\]:]+/).filter(Boolean)
        if (mWords.includes(t)) tokenScore = Math.max(tokenScore, 500)
        else if (matchesWordBoundary(meta, t)) tokenScore = Math.max(tokenScore, 300)
        else if (meta.includes(t)) tokenScore = Math.max(tokenScore, 100)

        if (t.length < 4) {
          if (code === t) tokenScore = Math.max(tokenScore, 3000)
          else if (code.startsWith(t)) tokenScore = Math.max(tokenScore, 1500)
        } else {
          if (code === t) tokenScore = Math.max(tokenScore, 3000)
          else if (code.startsWith(t)) tokenScore = Math.max(tokenScore, 1500)
          else if (code.includes(t)) tokenScore = Math.max(tokenScore, 100)
        }
      }

      if (tokenScore === 0) {
        score = 0
        break
      }
      score += tokenScore
    }

    if (score > 0) {
      if (allTokensInPrimary) score += 6000
      if (allTokensInPrimary && inOrderInPrimary) score += 4000
      const lenDiff = Math.max(0, primary.length - q.length)
      score += Math.max(0, 500 - lenDiff * 4)
      scored.push({ item, score, primaryText: primary })
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.primaryText.length !== b.primaryText.length) {
      return a.primaryText.length - b.primaryText.length
    }
    return a.primaryText.localeCompare(b.primaryText)
  })

  return scored.map(s => s.item)
}
