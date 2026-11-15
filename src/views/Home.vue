<template>
  <section class="container page">
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

    <div v-else class="card overview">
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
        <StarTrendingChart v-else-if="points.length" ref="chart" :points="points" :granularity="granularity" />
      </div>

      <p class="footnote">
        Times are in your time zone, {{ timeZone }}; the latest {{ noun }} is still in progress.
        <template v-if="truncated">
          GitHub only lists the first {{ formatNumber(stars.length) }} stargazers, so the chart stops there; the total above is exact.
        </template>
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import { fetchRepository, fetchStargazers, GitHubError } from '../github/api/v3'
import { getToken } from '../github/token'
import {
  GRANULARITIES, buildSeries, formatDate, formatNumber, formatPeriod, localTimeZone, parseGranularity,
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
const error = ref(null)
const progress = ref({ done: 0, total: 0 })
const chart = ref(null)
let loadId = 0

const avatar = computed(() => {
  const url = new URL(meta.value.owner.avatar_url)
  url.searchParams.set('s', '96')
  return url.href
})

const loading = computed(() => !error.value && !stars.value)

const points = computed(() => (meta.value && stars.value
  ? buildSeries(stars.value, meta.value.created_at, granularity.value)
  : []))

const stats = computed(() => {
  if (!points.value.length) return null
  const peak = points.value.reduce((best, p) => (p.added > best.added ? p : best))
  const fetched = points.value.at(-1).total
  const average = fetched / points.value.length
  let firstStar = Infinity
  for (const s of stars.value) firstStar = Math.min(firstStar, Date.parse(s))
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
  return total > 1
    ? `Fetching stargazers · page ${formatNumber(done)} of ${formatNumber(total)}`
    : 'Fetching stargazers…'
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

async function load(force = false) {
  const id = ++loadId
  const target = repo.value
  error.value = null
  progress.value = { done: 0, total: 0 }
  if (!target) return

  const cached = !force && cache.get(target.toLowerCase())
  meta.value = cached?.meta ?? null
  stars.value = cached?.stars ?? null
  if (cached) return

  const token = getToken()
  try {
    const repoMeta = await fetchRepository(target, token)
    if (id !== loadId) return
    meta.value = repoMeta
    const starredAt = await fetchStargazers(target, token, (done, total) => {
      if (id === loadId) progress.value = { done, total }
    })
    if (id !== loadId) return
    cache.set(target.toLowerCase(), { meta: repoMeta, stars: starredAt })
    stars.value = starredAt
  } catch (e) {
    if (id !== loadId) return
    if (e instanceof GitHubError && e.status === 401) {
      router.replace({ name: 'settings', query: { redirect: route.fullPath, error: 'unauthorized' } })
      return
    }
    error.value = describe(e)
  }
}

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

/* overview card */
.overview { overflow: hidden; }

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
