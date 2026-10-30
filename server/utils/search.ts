// Server-side multi-token search and ranking utilities for Prisma and API endpoints

export function buildMultiTokenPrismaOr(
  query: string,
  fieldMappers: ((term: string) => any[]) | ((term: string) => any)[]
): any {
  const q = String(query || '').trim()
  if (!q) return undefined

  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return undefined

  // Support both a generator function `(token) => [cond1, cond2]` and an array of mapper functions `[fn1, fn2]`
  return {
    AND: tokens.map(token => {
      if (typeof fieldMappers === 'function') {
        const conditions = fieldMappers(token)
        return { OR: Array.isArray(conditions) ? conditions : [conditions] }
      }
      if (Array.isArray(fieldMappers)) {
        return {
          OR: fieldMappers.flatMap(mapFn => {
            const res = mapFn(token)
            return Array.isArray(res) ? res : [res]
          })
        }
      }
      return { OR: [] }
    })
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

  return [...items].sort((a, b) => {
    const scoreA = computeItemScore(a, q, tokens, fieldMap)
    const scoreB = computeItemScore(b, q, tokens, fieldMap)
    return scoreB - scoreA
  })
}

function computeItemScore<T>(
  item: T,
  fullQuery: string,
  tokens: string[],
  fieldMap: {
    primary?: (item: T) => string | null | undefined
    secondary?: (item: T) => string | null | undefined
    meta?: (item: T) => string | null | undefined
    code?: (item: T) => string | null | undefined
  }
): number {
  let score = 0
  const primary = (fieldMap.primary ? fieldMap.primary(item) : '')?.toLowerCase() || ''
  const secondary = (fieldMap.secondary ? fieldMap.secondary(item) : '')?.toLowerCase() || ''
  const meta = (fieldMap.meta ? fieldMap.meta(item) : '')?.toLowerCase() || ''
  const code = (fieldMap.code ? fieldMap.code(item) : '')?.toLowerCase() || ''

  // 1. Exact full query matches
  if (primary === fullQuery) score += 1000
  else if (primary.startsWith(fullQuery)) score += 600
  else if (matchesWordBoundary(primary, fullQuery)) score += 400
  else if (primary.includes(fullQuery)) score += 200

  if (secondary === fullQuery) score += 700
  else if (secondary.startsWith(fullQuery)) score += 400

  if (code === fullQuery) score += 500
  else if (code.startsWith(fullQuery)) score += 300

  // 2. Token-by-token evaluation
  let allTokensMatchPrimaryWord = true
  for (const token of tokens) {
    if (matchesWordBoundary(primary, token)) {
      score += 150
    } else if (primary.includes(token)) {
      score += 70
      allTokensMatchPrimaryWord = false
    } else {
      allTokensMatchPrimaryWord = false
    }

    if (secondary.startsWith(token)) score += 80
    else if (secondary.includes(token)) score += 40

    if (meta.startsWith(token)) score += 60
    else if (meta.includes(token)) score += 20

    if (code.startsWith(token)) score += 70
  }

  if (allTokensMatchPrimaryWord && tokens.length > 1) {
    score += 250
  }

  return score
}
