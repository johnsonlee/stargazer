<template>
  <section v-if="!repo" class="container hero">
    <div class="hero-glow" aria-hidden="true"></div>
    <p class="eyebrow"><Icon name="star" :size="12" /> Star history for any GitHub repository</p>
    <h1>Watch a repository grow,<br />one star at a time.</h1>
    <p class="hero-lede">
      Enter <code>owner/repository</code> above to see total stars over time and how many arrived each day, week or month.
    </p>
    <div class="examples">
      <RouterLink v-for="example in EXAMPLES" :key="example" :to="`/${example}`" class="chip">
        {{ example }}
      </RouterLink>
    </div>
  </section>

  <section v-else class="container page">
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
        <span class="meta-item">Created {{ formatDate(meta.created_at) }}</span>
      </div>
    </header>

    <div v-if="error" class="card state state-error">
      <h2>{{ error.title }}</h2>
      <p>{{ error.detail }}</p>
      <button class="btn btn-ghost" @click="load(true)">Try again</button>
    </div>

    <template v-else>
      <div class="stats">
        <div class="card stat stat-primary">
          <span class="stat-label">Total stars</span>
          <span class="stat-value">
            <template v-if="meta">{{ formatNumber(meta.stargazers_count) }}</template>
            <span v-else class="skeleton-num"></span>
          </span>
          <span class="stat-sub">on GitHub today</span>
        </div>
        <div class="card stat">
          <span class="stat-label">This {{ noun }}</span>
          <span class="stat-value">
            <template v-if="stats">+{{ formatNumber(stats.latest.added) }}</template>
            <span v-else class="skeleton-num"></span>
          </span>
          <span class="stat-sub">{{ stats ? formatPeriod(stats.latest.start, granularity) : '' }}</span>
        </div>
        <div class="card stat">
          <span class="stat-label">Best {{ noun }}</span>
          <span class="stat-value">
            <template v-if="stats">+{{ formatNumber(stats.peak.added) }}</template>
            <span v-else class="skeleton-num"></span>
          </span>
          <span class="stat-sub">{{ stats && stats.peak.added ? formatPeriod(stats.peak.start, granularity) : '' }}</span>
        </div>
        <div class="card stat">
          <span class="stat-label">Average per {{ noun }}</span>
          <span class="stat-value">
            <template v-if="stats">{{ stats.average }}</template>
            <span v-else class="skeleton-num"></span>
          </span>
          <span class="stat-sub">{{ stats ? `across ${formatNumber(points.length)} ${noun}s` : '' }}</span>
        </div>
      </div>

      <div class="card chart-card">
        <div class="chart-head">
          <div>
            <h2>Star history</h2>
            <p class="chart-sub">Cumulative stars and new stars per {{ noun }} (UTC)</p>
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

        <div v-if="loading" class="chart-loading">
          <div class="progress" :style="{ '--progress': progressRatio }"><span></span></div>
          <p>{{ progressText }}</p>
        </div>
        <StarTrendingChart v-else-if="points.length" ref="chart" :points="points" :granularity="granularity" />

        <p v-if="truncated" class="footnote">
          GitHub only lists the first {{ formatNumber(stars.length) }} stargazers, so the chart stops there. The total above is exact.
        </p>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import { fetchRepository, fetchStargazers, GitHubError } from '../github/api/v3'
import { getToken } from '../github/token'
import {
  GRANULARITIES, buildSeries, formatDate, formatNumber, formatPeriod, parseGranularity,
} from '../lib/series'

// ECharts is the bulk of the bundle; load it only once a chart is shown.
const StarTrendingChart = defineAsyncComponent(() => import('../components/chart/StarTrendingChart.vue'))

const EXAMPLES = ['vuejs/core', 'vitejs/vite', 'didi/booster', 'apache/echarts']

// Stargazer lists are expensive to fetch; keep them for the session so switching
// granularity or navigating back is instant.
const cache = new Map()

const route = useRoute()
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
  return {
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
/* ---------- landing ---------- */
.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-top: clamp(64px, 14vh, 140px);
  padding-bottom: 96px;
}

.hero-glow {
  position: absolute;
  inset: 0 0 auto;
  height: 420px;
  margin: 0 auto;
  max-width: 720px;
  background: radial-gradient(closest-side, var(--accent-glow), transparent);
  opacity: .55;
  filter: blur(40px);
  pointer-events: none;
  z-index: -1;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 20px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text-2);
  font-size: 13px;
}
.eyebrow .icon { color: var(--accent); }

.hero h1 {
  margin: 0;
  font-size: clamp(32px, 6vw, 56px);
  line-height: 1.06;
  font-weight: 700;
  letter-spacing: -0.035em;
  text-wrap: balance;
}

.hero-lede {
  max-width: 520px;
  margin: 20px 0 32px;
  color: var(--text-2);
  font-size: 17px;
  text-wrap: pretty;
}

code {
  font-family: var(--mono);
  font-size: .88em;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.examples {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.chip {
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text-2);
  text-decoration: none;
  transition: border-color .15s, color .15s, transform .15s;
}
.chip:hover { border-color: var(--accent); color: var(--text); transform: translateY(-1px); }

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

/* stats */
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 16px 18px;
  min-width: 0;
}

.stat-label { font-size: 12.5px; font-weight: 550; color: var(--muted); }

.stat-value {
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}

.stat-primary .stat-value { color: var(--accent-strong); }

.stat-sub {
  min-height: 1.5em;
  font-size: 12.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 860px) {
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* chart card */
.chart-card { padding: 20px 20px 12px; }

.chart-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 16px;
  margin-bottom: 12px;
}

.chart-head h2 { margin: 0; font-size: 16px; font-weight: 650; letter-spacing: -0.01em; }
.chart-sub { margin: 2px 0 0; font-size: 13px; color: var(--muted); }

.chart-tools { display: flex; align-items: center; gap: 8px; }

.segmented {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 3px;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.segmented-thumb {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc((100% - 6px) / 3);
  border-radius: 7px;
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .08), 0 0 0 1px var(--border);
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
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--muted);
  cursor: pointer;
  transition: color .15s, border-color .15s;
}
.icon-action:hover:not(:disabled) { color: var(--text); border-color: var(--border-strong); }
.icon-action:disabled { opacity: .4; cursor: default; }

.chart-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  height: clamp(320px, 56vh, 520px);
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
  margin: 4px 0 4px;
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

@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

@media (max-width: 559px) {
  .page { padding-top: 24px; }
  .chart-card { padding: 16px 12px 8px; }
  .chart-tools { width: 100%; }
  .segmented { flex: 1; }
  .segmented button { min-width: 0; }
  .stat { padding: 14px; }
  .stat-value { font-size: 22px; }
}
</style>
