// The repository page's auto-refresh interval, in minutes (0 = off), kept per browser.

export const REFRESH_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 0, label: 'Off' },
]

// Five minutes is both the default and the shortest interval: refreshes are incremental,
// but anything faster would mostly re-read pages that haven't changed.
export const DEFAULT_REFRESH = 5

const KEY = 'refresh-interval'

export function getRefreshInterval() {
  try {
    const raw = localStorage.getItem(KEY)
    const value = Number(raw)
    return raw !== null && REFRESH_OPTIONS.some((o) => o.value === value) ? value : DEFAULT_REFRESH
  } catch {
    return DEFAULT_REFRESH
  }
}

export function setRefreshInterval(value) {
  try {
    localStorage.setItem(KEY, String(value))
  } catch {
    // storage unavailable; the choice lasts for this page only
  }
}
