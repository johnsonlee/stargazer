// Buckets follow the viewer's local time zone (calendar days, Monday-start weeks, months),
// stepping with calendar arithmetic so DST transitions never skip or duplicate a day.

export const GRANULARITIES = [
  { value: 'day', label: 'Day', noun: 'day' },
  { value: 'week', label: 'Week', noun: 'week' },
  { value: 'month', label: 'Month', noun: 'month' },
]

export function parseGranularity(value) {
  return GRANULARITIES.some((g) => g.value === value) ? value : 'day'
}

function bucketStart(time, granularity) {
  const d = new Date(time)
  if (granularity === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (granularity === 'week') day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  return day.getTime()
}

function nextBucket(start, granularity) {
  const d = new Date(start)
  if (granularity === 'month') return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (granularity === 'week' ? 7 : 1)).getTime()
}

/**
 * Buckets star timestamps into contiguous local-time periods from the repository's
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
  const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  return granularity === 'month' ? ym : `${ym}-${pad(d.getDate())}`
}

const dayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
})
const rangeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
})
const monthFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long', year: 'numeric',
})

export function formatPeriod(start, granularity) {
  if (granularity === 'week') {
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return `Week of ${rangeFormat.formatRange(new Date(start), end)}`
  }
  if (granularity === 'month') return monthFormat.format(new Date(start))
  return dayFormat.format(new Date(start))
}

/** The viewer's time zone, e.g. "Asia/Shanghai (GMT+8)". */
export function localTimeZone() {
  const name = Intl.DateTimeFormat().resolvedOptions().timeZone
  const offset = new Intl.DateTimeFormat('en-US', { timeZoneName: 'shortOffset' })
    .formatToParts(new Date())
    .find((part) => part.type === 'timeZoneName')?.value
  return offset && name !== 'UTC' ? `${name} (${offset})` : name
}

export function formatDate(value) {
  return rangeFormat.format(new Date(value))
}

const numberFormat = new Intl.NumberFormat('en-US')
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export const formatNumber = (n) => numberFormat.format(n)
export const formatCompact = (n) => compactFormat.format(n)
