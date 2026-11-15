<template>
  <section class="container container-wide page">
    <header class="repo-head">
      <div class="repo-title">
        <img v-if="meta" class="avatar" :src="avatar" alt="" width="40" height="40" />
        <div v-else class="avatar skeleton"></div>
        <div class="repo-text">
          <h1>
            <a :href="`https://github.com/${repo}`" target="_blank" rel="noopener">
              <span class="owner">{{ owner }}/</span>{{ name }}
            </a>
          </h1>
          <p v-if="meta?.description" class="description">{{ meta.description }}</p>
          <p v-else-if="!meta && !error" class="description skeleton-text"></p>
        </div>
      </div>
      <div v-if="meta" class="repo-meta">
        <span v-if="meta.language" class="meta-item">{{ meta.language }}</span>
        <span v-if="Number.isFinite(meta.forks_count)" class="meta-item">{{ formatNumber(meta.forks_count) }} forks</span>
      </div>
    </header>

    <div v-if="error" class="card state state-error">
      <h2>{{ error.title }}</h2>
      <p>{{ error.detail }}</p>
      <button class="btn btn-ghost" @click="load(true)">Try again</button>
    </div>

    <div v-else class="columns" :class="{ 'with-audience': !restricted }">
      <div class="card overview">
        <div class="overview-head">
          <div class="hero-figure">
            <span class="figure-label">Total stars</span>
            <span class="hero-value">
              <template v-if="meta">{{ formatNumber(meta.stargazers_count) }}</template>
              <span v-else class="skeleton-num skeleton-hero"></span>
            </span>
            <span class="hero-delta">
              <template v-if="stats">
                <span :class="{ up: stats.latest.added > 0 }">+{{ formatNumber(stats.latest.added) }}</span> {{ granularity === 'day' ? 'today' : `this ${noun}` }} so far
              </template>
            </span>
          </div>
          <div class="chart-tools">
            <div class="segmented" role="radiogroup" aria-label="Group by" :style="{ '--index': granularityIndex }">
              <span class="segmented-thumb" aria-hidden="true"></span>
              <button
                v-for="g in GRANULARITIES"
                :key="g.value"
                type="button"
                role="radio"
                :aria-checked="g.value === granularity"
                :class="{ active: g.value === granularity }"
                @click="setGranularity(g.value)"
              >
                {{ g.label }}
              </button>
            </div>
            <label class="refresh-select" :class="{ refreshing }" title="Auto-refresh interval">
              <Icon name="refresh" :size="15" />
              <select v-model.number="refreshInterval" aria-label="Auto-refresh interval">
                <option v-for="o in REFRESH_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </label>
            <button class="icon-action" :disabled="!points.length" title="Download PNG" aria-label="Download chart as PNG" @click="chart?.download(`${owner}-${name}-stars-by-${granularity}`)">
              <Icon name="download" :size="16" />
            </button>
          </div>
        </div>

        <dl class="figures">
          <div class="figure">
            <dt>Best {{ noun }}</dt>
            <dd>
              <template v-if="stats">+{{ formatNumber(stats.peak.added) }}</template>
              <span v-else class="skeleton-num"></span>
            </dd>
            <dd class="figure-sub">{{ stats && stats.peak.added ? formatPeriod(stats.peak.start, granularity) : '' }}</dd>
          </div>
          <div class="figure">
            <dt>Average per {{ noun }}</dt>
            <dd>
              <template v-if="stats">{{ stats.average }}</template>
              <span v-else class="skeleton-num"></span>
            </dd>
            <dd class="figure-sub">{{ stats ? `across ${formatNumber(points.length)} ${noun}s` : '' }}</dd>
          </div>
          <div class="figure">
            <dt>First star</dt>
            <dd>
              <template v-if="stats">{{ stats.firstStar ? formatDate(stats.firstStar) : '—' }}</template>
              <span v-else class="skeleton-num"></span>
            </dd>
            <dd class="figure-sub">{{ meta ? `repository created ${formatDate(meta.created_at)}` : '' }}</dd>
          </div>
        </dl>

        <div class="chart-area">
          <div v-if="loading" class="chart-loading">
            <div class="progress" :style="{ '--progress': progressRatio }"><span></span></div>
            <p>{{ progressText }}</p>
          </div>
          <StarTrendingChart v-else-if="points.length" ref="chart" :points="points" :granularity="granularity" @range="setRange" />
        </div>

        <p class="footnote">
          <template v-if="restricted">
            Days are UTC calendar days, grouped into weeks and months in your time zone, {{ timeZone }}; the latest {{ noun }} is still in progress.
            GitHub shows who starred a repository only to its admins and collaborators, so there are no stargazer profiles to analyze here.
          </template>
          <template v-else>Times are in your time zone, {{ timeZone }}; the latest {{ noun }} is still in progress.</template>
          <template v-if="truncated">
            GitHub only lists the first {{ formatNumber(stars.length) }} stargazers, so the chart stops there; the total above is exact.
          </template>
          <span v-if="updatedAt" class="refresh-status">
            {{ refreshStatus }}
          </span>
        </p>
      </div>

      <Audience v-if="!restricted" :repo="repo" :stargazers="stars" :range="range" @reset-range="chart?.resetZoom()" />
    </div>
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Audience from '../components/Audience.vue'
import Icon from '../components/Icon.vue'
import {
  fetchNewStargazers, fetchNewStarHistory, fetchRepository, fetchStargazers, fetchStarHistory, GitHubError,
} from '../github/api/v3'
import { getToken } from '../github/token'
import { REFRESH_OPTIONS, getRefreshInterval, setRefreshInterval } from '../lib/refresh'
import {
  GRANULARITIES, buildSeries, dailyEvents, formatDate, formatNumber, formatPeriod, localTimeZone, parseGranularity, starEvents,
} from '../lib/series'

// ECharts is the bulk of the bundle; load it only once a chart is shown.
const StarTrendingChart = defineAsyncComponent(() => import('../components/chart/StarTrendingChart.vue'))

// Stargazer lists are expensive to fetch; keep them for the session so switching
// granularity or navigating back is instant.
const cache = new Map()

const route = useRoute()
const timeZone = localTimeZone()
const router = useRouter()

const owner = computed(() => route.params.owner || '')
const name = computed(() => route.params.repo || '')
const repo = computed(() => (owner.value && name.value ? `${owner.value}/${name.value}` : ''))
const granularity = computed(() => parseGranularity(route.query.by))
const granularityIndex = computed(() => GRANULARITIES.findIndex((g) => g.value === granularity.value))
const noun = computed(() => GRANULARITIES[granularityIndex.value].noun)

const meta = shallowRef(null)
const stars = shallowRef(null)
// daily star totals, used instead of `stars` when GitHub won't list the stargazers
const history = shallowRef(null)
const error = ref(null)
const progress = ref({ done: 0, total: 0 })
const chart = ref(null)
// the time range zoomed into on the chart, `null` for all time
const range = shallowRef(null)
// Only a different range is passed on, so a refresh that keeps the zoom doesn't make
// the audience re-read the period.
function setRange(next) {
  if (next?.from !== range.value?.from || next?.to !== range.value?.to) range.value = next
}
let loadId = 0

const avatar = computed(() => {
  const url = new URL(meta.value.owner.avatar_url)
  url.searchParams.set('s', '96')
  return url.href
})

const loading = computed(() => !error.value && !stars.value && !history.value)

// GitHub lists stargazers only to a repository's admins and collaborators; elsewhere
// the chart is drawn from daily totals and there are no profiles to analyze.
const restricted = computed(() => !!history.value)

const events = computed(() => {
  if (stars.value) return starEvents(stars.value.map((s) => s.starredAt))
  return history.value ? dailyEvents(history.value) : []
})

const points = computed(() => (meta.value && !loading.value
  ? buildSeries(events.value, meta.value.created_at, granularity.value)
  : []))

const stats = computed(() => {
  if (!points.value.length) return null
  const peak = points.value.reduce((best, p) => (p.added > best.added ? p : best))
  const fetched = points.value.at(-1).total
  const average = fetched / points.value.length
  let firstStar = Infinity
  for (const e of events.value) firstStar = Math.min(firstStar, e.time)
  return {
    firstStar: Number.isFinite(firstStar) ? firstStar : null,
    latest: points.value.at(-1),
    peak,
    average: average >= 10 ? formatNumber(Math.round(average)) : average.toFixed(1),
  }
})

const truncated = computed(() => meta.value && stars.value && stars.value.length >= 40_000
  && stars.value.length < meta.value.stargazers_count)

const progressRatio = computed(() => (progress.value.total ? progress.value.done / progress.value.total : 0))
const progressText = computed(() => {
  if (!meta.value) return 'Looking up repository…'
  const { done, total } = progress.value
  const what = progress.value.history ? 'star history' : 'stargazers'
  return total > 1
    ? `Fetching ${what} · page ${formatNumber(done)} of ${formatNumber(total)}`
    : `Fetching ${what}…`
})

function setGranularity(value) {
  const query = { ...route.query }
  if (value === 'day') delete query.by
  else query.by = value
  router.replace({ query })
}

function describe(e) {
  if (e instanceof GitHubError) {
    if (e.status === 404) return { title: 'Repository not found', detail: `GitHub has no public repository named ${repo.value}, or your token can’t see it.` }
    if (e.status === 403 || e.status === 429) return { title: 'Rate limit reached', detail: 'GitHub is throttling requests for this token. Wait a few minutes and try again.' }
    return { title: 'GitHub returned an error', detail: e.message }
  }
  return { title: 'Couldn’t reach GitHub', detail: 'Check your connection and try again.' }
}

// Shows freshly fetched data and remembers it for the session.
function show(target, data) {
  cache.set(target.toLowerCase(), { ...data, at: Date.now() })
  meta.value = data.meta
  stars.value = data.stars
  history.value = data.history
  updatedAt.value = Date.now()
  refreshFailedAt.value = null
}

async function load(force = false) {
  const id = ++loadId
  const target = repo.value
  error.value = null
  progress.value = { done: 0, total: 0 }
  range.value = null
  clearTimeout(refreshTimer)
  refreshing.value = false
  refreshFailedAt.value = null
  updatedAt.value = null
  if (!target) return

  const cached = !force && cache.get(target.toLowerCase())
  meta.value = cached?.meta ?? null
  stars.value = cached?.stars ?? null
  history.value = cached?.history ?? null
  if (cached) {
    // a revisit continues the refresh cycle from when the data was fetched
    updatedAt.value = cached.at
    lastAttempt = cached.at
    schedule()
    return
  }

  const token = getToken()
  try {
    const repoMeta = await fetchRepository(target, token)
    if (id !== loadId) return
    meta.value = repoMeta
    let stargazers = null
    // GitHub lists stargazers only to admins and collaborators. Skip a request that is
    // bound to 404 when the permissions already say so; otherwise try, and treat a 404
    // (the repository itself exists, its metadata loaded) the same way.
    const { permissions } = repoMeta
    if (!permissions || permissions.admin || permissions.push) {
      try {
        stargazers = await fetchStargazers(target, token, (done, total) => {
          if (id === loadId) progress.value = { done, total }
        })
      } catch (e) {
        if (!(e instanceof GitHubError && e.status === 404)) throw e
      }
    }
    if (id !== loadId) return
    if (stargazers) {
      show(target, { meta: repoMeta, stars: stargazers, history: null })
      lastAttempt = Date.now()
      schedule()
      return
    }
    progress.value = { done: 0, total: 0, history: true }
    const days = await fetchStarHistory(target, token, (done, total) => {
      if (id === loadId) progress.value = { done, total, history: true }
    })
    if (id !== loadId) return
    show(target, { meta: repoMeta, stars: null, history: days })
    lastAttempt = Date.now()
    schedule()
  } catch (e) {
    if (id !== loadId) return
    if (e instanceof GitHubError && e.status === 401) {
      router.replace({ name: 'settings', query: { redirect: route.fullPath, error: 'unauthorized' } })
      return
    }
    error.value = describe(e)
  }
}

// ---------- auto-refresh ----------
// Refreshes are partial and silent: only new stargazer pages (or the latest weeks of
// history) are read, the page never goes back to its loading state, and the chart
// merges the new points in place, keeping the zoom.

const refreshInterval = ref(getRefreshInterval())
const updatedAt = ref(null)
const refreshing = ref(false)
const refreshFailedAt = ref(null)
let refreshTimer = null
let lastAttempt = 0
// a refresh came due while the tab was hidden; run it when the tab is shown again
let refreshDue = false

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

const refreshStatus = computed(() => {
  const every = REFRESH_OPTIONS.find((o) => o.value === refreshInterval.value)
  const cycle = refreshInterval.value ? `refreshing every ${every.label}` : 'auto-refresh is off'
  if (refreshFailedAt.value) return `Couldn’t refresh at ${timeFormat.format(refreshFailedAt.value)}; showing data from ${timeFormat.format(updatedAt.value)}, ${cycle}.`
  return `Updated ${timeFormat.format(updatedAt.value)}, ${cycle}.`
})

function schedule() {
  clearTimeout(refreshTimer)
  refreshDue = false
  if (!refreshInterval.value || !updatedAt.value) return
  const wait = Math.max(0, lastAttempt + refreshInterval.value * 60_000 - Date.now())
  refreshTimer = setTimeout(() => {
    if (document.hidden) refreshDue = true
    else refresh()
  }, wait)
}

/** `next` unless it holds the same stargazers as `current`, so unchanged data isn't redrawn. */
const sameStars = (current, next) => current.length === next.length && current.at(-1)?.id === next.at(-1)?.id
const sameDays = (current, next) => current.length === next.length
  && current.every((d, i) => d.date === next[i].date && d.count === next[i].count)

async function refresh() {
  const id = loadId
  const target = repo.value
  if (!target || refreshing.value || !meta.value || (!stars.value && !history.value)) return
  refreshing.value = true
  lastAttempt = Date.now()
  const token = getToken()
  try {
    const repoMeta = await fetchRepository(target, token)
    let nextStars = stars.value
    let nextHistory = history.value
    if (stars.value) {
      // `null` when earlier pages shifted (someone unstarred): read them all again
      const fresh = await fetchNewStargazers(target, token, stars.value) ?? await fetchStargazers(target, token)
      if (!sameStars(stars.value, fresh)) nextStars = fresh
    } else {
      const fresh = await fetchNewStarHistory(target, token, history.value)
      if (!sameDays(history.value, fresh)) nextHistory = fresh
    }
    if (id !== loadId) return
    show(target, { meta: repoMeta, stars: nextStars, history: nextHistory })
  } catch (e) {
    if (id !== loadId) return
    if (e instanceof GitHubError && e.status === 401) {
      router.replace({ name: 'settings', query: { redirect: route.fullPath, error: 'unauthorized' } })
      return
    }
    // keep showing what we have; the next cycle tries again
    refreshFailedAt.value = Date.now()
  } finally {
    if (id === loadId) {
      refreshing.value = false
      schedule()
    }
  }
}

function onVisibility() {
  if (!document.hidden && refreshDue) refresh()
}
document.addEventListener('visibilitychange', onVisibility)

watch(refreshInterval, (value) => {
  setRefreshInterval(value)
  schedule()
})

onBeforeUnmount(() => {
  clearTimeout(refreshTimer)
  document.removeEventListener('visibilitychange', onVisibility)
})

watch(repo, () => load(), { immediate: true })
</script>

<style scoped>
/* ---------- repository page ---------- */
.page { padding-top: 32px; padding-bottom: 64px; }

.repo-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 24px;
  margin-bottom: 24px;
}

.repo-title { display: flex; align-items: flex-start; gap: 14px; min-width: 0; }

.avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.repo-text { min-width: 0; }

.repo-text h1 {
  margin: 0;
  font-size: clamp(20px, 3.4vw, 26px);
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.repo-text h1 a { text-decoration: none; }
.repo-text h1 a:hover { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
.owner { color: var(--muted); font-weight: 500; }

.description {
  margin: 4px 0 0;
  max-width: 640px;
  color: var(--text-2);
  text-wrap: pretty;
}

.repo-meta { display: flex; flex-wrap: wrap; gap: 8px; }

.meta-item {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 12.5px;
  white-space: nowrap;
}

/* Cards stack on narrow screens. On wide ones the audience card takes the right column
   and its sign-ups/most-followed card sits under the trend; both stretch to the same
   bottom edge, so the columns end flush whatever the data. */
.columns { display: grid; gap: 16px; }
.overview { overflow: hidden; }

@media (min-width: 1280px) {
  .columns.with-audience {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    grid-template-rows: auto 1fr;
  }
  .with-audience .overview { grid-area: 1 / 1; align-self: start; }
  .columns > :deep(.audience) { grid-area: 1 / 2 / span 2; }
  .columns > :deep(.audience-more) { grid-area: 2 / 1; }
}

.overview-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px 24px;
  padding: 24px 24px 20px;
}

.hero-figure { display: flex; flex-direction: column; min-width: 0; }

.figure-label, .figures dt {
  font-size: 13px;
  font-weight: 550;
  color: var(--muted);
}

.hero-value {
  margin-top: 2px;
  font-size: clamp(40px, 7vw, 56px);
  font-weight: 650;
  letter-spacing: -0.035em;
  line-height: 1.05;
}

.hero-delta {
  min-height: 1.5em;
  margin-top: 8px;
  font-size: 14px;
  color: var(--text-2);
}
.hero-delta .up { color: var(--success); font-weight: 600; }

.figures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.figure {
  padding: 14px 24px;
  min-width: 0;
}
.figure + .figure { border-left: 1px solid var(--border); }

.figures dd { margin: 0; }

.figures dd:not(.figure-sub) {
  margin-top: 2px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.35;
}

.figure-sub {
  min-height: 1.5em;
  font-size: 12.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chart-area { padding: 20px 20px 8px 24px; }

.chart-tools { display: flex; align-items: center; gap: 8px; }

.segmented {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 3px;
  border-radius: 10px;
  background: var(--surface-2);
}

.segmented-thumb {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc((100% - 6px) / 3);
  border-radius: 7px;
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .1), 0 0 0 1px var(--border);
  transform: translateX(calc(var(--index) * 100%));
  transition: transform .25s cubic-bezier(.3, .7, .2, 1);
}

.segmented button {
  position: relative;
  min-width: 64px;
  height: 30px;
  padding: 0 12px;
  border: 0;
  background: none;
  font-size: 13px;
  font-weight: 550;
  color: var(--muted);
  cursor: pointer;
  transition: color .15s;
}
.segmented button:hover, .segmented button.active { color: var(--text); }

.refresh-select {
  position: relative;
  display: flex;
  align-items: center;
  height: 36px;
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--muted);
  transition: color .15s;
}
.refresh-select:hover, .refresh-select:focus-within { color: var(--text); }
.refresh-select .icon {
  position: absolute;
  left: 10px;
  pointer-events: none;
}
.refresh-select.refreshing .icon { animation: spin 1s linear infinite; }
.refresh-select select {
  height: 100%;
  padding: 0 28px 0 31px;
  border: 0;
  border-radius: inherit;
  background: transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238a8a93' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 11px center;
  font-size: 13px;
  font-weight: 550;
  color: inherit;
  cursor: pointer;
  appearance: none;
}
.refresh-select select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.refresh-select option { color: var(--text); background: var(--surface); }

@keyframes spin {
  to { transform: rotate(360deg); }
}

.icon-action {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 0;
  background: var(--surface-2);
  color: var(--muted);
  cursor: pointer;
  transition: color .15s, background-color .15s;
}
.icon-action:hover:not(:disabled) { color: var(--text); }
.icon-action:disabled { opacity: .4; cursor: default; }

.chart-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  height: clamp(360px, 54vh, 500px);
  color: var(--muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.chart-loading p { margin: 0; }

.progress {
  width: min(280px, 70%);
  height: 4px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}
.progress span {
  display: block;
  height: 100%;
  width: calc(max(var(--progress), .06) * 100%);
  border-radius: inherit;
  background: var(--accent);
  transition: width .25s ease;
}

.footnote {
  margin: 0;
  padding: 0 24px 18px;
  font-size: 12.5px;
  color: var(--muted);
}

/* error */
.state { padding: 40px 24px; text-align: center; }
.state h2 { margin: 0 0 6px; font-size: 18px; letter-spacing: -0.01em; }
.state p { margin: 0 auto 20px; max-width: 440px; color: var(--text-2); }
.state-error h2 { color: var(--danger); }

/* skeletons */
.skeleton, .skeleton-text, .skeleton-num {
  background: linear-gradient(90deg, var(--surface-2), var(--border), var(--surface-2));
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
.skeleton-text { height: 14px; width: min(360px, 60vw); border-radius: 6px; margin-top: 10px; }
.skeleton-num { display: inline-block; width: 72px; height: 22px; border-radius: 6px; vertical-align: middle; }
.skeleton-hero { width: 160px; height: 48px; border-radius: 10px; }

@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

@media (max-width: 559px) {
  .page { padding-top: 24px; }
  .overview-head { padding: 20px 16px 16px; }
  .chart-tools { width: 100%; }
  .segmented { flex: 1; }
  .segmented button { min-width: 0; }
  .figures { grid-template-columns: 1fr; }
  .figure { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 10px 16px; }
  .figure + .figure { border-left: 0; border-top: 1px solid var(--border); }
  .figures dt { flex: 1; }
  .figures dd:not(.figure-sub) { font-size: 16px; }
  .figure-sub { display: none; }
  .chart-area { padding: 16px 8px 4px 16px; }
  .footnote { padding: 0 16px 16px; }
}
</style>
