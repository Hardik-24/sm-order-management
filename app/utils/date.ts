/**
 * Date utility helpers for Silicon Marketing OMS
 */

/**
 * Format a Date object to "YYYY-MM-DD" local date string
 */
export function formatDateYMD(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Return today's date formatted as "YYYY-MM-DD" in local time
 */
export function getTodayYMD(): string {
  return formatDateYMD(new Date())
}
