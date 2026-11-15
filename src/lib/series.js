// All bucketing is done in UTC, matching GitHub's `starred_at` timestamps.
const DAY = 86_400_000

export const GRANULARITIES = [
  { value: 'day', label: 'Day', noun: 'day' },
  { value: 'week', label: 'Week', noun: 'week' },
  { value: 'month', label: 'Month', noun: 'month' },
]

export function parseGranularity(value) {
  return GRANULARITIES.some((g) => g.value === value) ? value : 'day'
}

function bucketStart(time, granularity) {
  const day = Math.floor(time / DAY) * DAY
  if (granularity === 'week') {
    // ISO weeks start on Monday
    return day - ((new Date(day).getUTCDay() + 6) % 7) * DAY
  }
  if (granularity === 'month') {
    const d = new Date(day)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
  }
  return day
}

function nextBucket(start, granularity) {
  if (granularity === 'week') return start + 7 * DAY
  if (granularity === 'month') {
    const d = new Date(start)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
  }
  return start + DAY
}

/**
 * Buckets star timestamps into contiguous periods from the repository's
 * creation (or its first star, whichever is earlier) up to `now`.
 * Returns `[{ start, added, total }]` where `total` is cumulative.
 */
export function buildSeries(starredAt, createdAt, granularity, now = Date.now()) {
  const counts = new Map()
  let first = Date.parse(createdAt)
  for (const s of starredAt) {
    const t = Date.parse(s)
    if (t < first) first = t
    const key = bucketStart(t, granularity)
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  const points = []
  const end = bucketStart(now, granularity)
  let total = 0
  for (let b = bucketStart(first, granularity); b <= end; b = nextBucket(b, granularity)) {
    const added = counts.get(b) || 0
    total += added
    points.push({ start: b, added, total })
  }
  return points
}

const pad = (n) => String(n).padStart(2, '0')

export function formatAxis(start, granularity) {
  const d = new Date(start)
  const ym = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
  return granularity === 'month' ? ym : `${ym}-${pad(d.getUTCDate())}`
}

const dayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
})
const rangeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
})
const monthFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
})

export function formatPeriod(start, granularity) {
  if (granularity === 'week') {
    return `Week of ${rangeFormat.formatRange(new Date(start), new Date(start + 6 * DAY))}`
  }
  if (granularity === 'month') return monthFormat.format(new Date(start))
  return dayFormat.format(new Date(start))
}

export function formatDate(value) {
  return rangeFormat.format(new Date(value))
}

const numberFormat = new Intl.NumberFormat('en-US')
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export const formatNumber = (n) => numberFormat.format(n)
export const formatCompact = (n) => compactFormat.format(n)
