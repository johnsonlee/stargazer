<template>
  <section class="card audience" aria-labelledby="audience-title">
    <header class="audience-head">
      <h2 id="audience-title">Who starred it</h2>
      <p class="audience-sub">
        <template v-if="audience">
          {{ formatNumber(audience.size) }} public profile{{ audience.size === 1 ? '' : 's' }}<template v-if="sampled">, sampled evenly from {{ formatNumber(stargazers.length) }} stargazers across the star history</template>
        </template>
        <template v-else>Profiles of the people behind the stars</template>
      </p>
    </header>

    <div v-if="error" class="state">
      <p>{{ error }}</p>
      <button class="btn btn-ghost" @click="load()">Try again</button>
    </div>

    <div v-else-if="!audience" class="loading">
      <div class="progress" :style="{ '--progress': progress.total ? progress.done / progress.total : 0 }"><span></span></div>
      <p>{{ progressText }}</p>
    </div>

    <template v-else-if="audience.size">
      <dl class="figures">
        <div class="figure">
          <dt>Median followers</dt>
          <dd>{{ formatNumber(audience.medianFollowers) }}</dd>
          <dd class="figure-sub">{{ percent(audience.followers.at(-2).count + audience.followers.at(-1).count) }} have 100 or more</dd>
        </div>
        <div class="figure">
          <dt>Median account age</dt>
          <dd>{{ formatYears(audience.medianAgeYears) }}</dd>
          <dd class="figure-sub">when starring · {{ formatNumber(audience.newAccounts) }} under a month old</dd>
        </div>
        <div class="figure">
          <dt>Active in the past year</dt>
          <dd>
            <template v-if="activity?.size">{{ percent(activity.active, activity.size) }}</template>
            <template v-else-if="activity || activityError">—</template>
            <span v-else class="skeleton-num"></span>
          </dd>
          <dd class="figure-sub">{{ activity?.size ? `median ${formatNumber(activity.median)} contribution${activity.median === 1 ? '' : 's'}` : '' }}</dd>
        </div>
        <div class="figure">
          <dt>Empty profiles</dt>
          <dd>{{ percent(audience.empty) }}</dd>
          <dd class="figure-sub">no followers, repositories or bio</dd>
        </div>
      </dl>

      <div class="panels">
        <BarList
          title="Countries and regions"
          :note="`${formatNumber(audience.recognized)} of ${formatNumber(audience.size)} list a recognizable location`"
          :rows="top(audience.countries, audience.recognized)"
          unit="stargazer"
          empty="No stargazer in the sample lists a recognizable location."
        />
        <BarList
          title="Companies"
          :note="`${formatNumber(audience.employed)} of ${formatNumber(audience.size)} list a company`"
          :rows="top(audience.companies, audience.employed)"
          unit="stargazer"
          empty="No stargazer in the sample lists a company."
        />
        <BarList
          title="Account age when starring"
          :note="`Of all ${profiles(audience.size)}`"
          :rows="share(audience.ages)"
          unit="stargazer"
        />
        <BarList
          title="Followers"
          :note="`Of all ${profiles(audience.size)}`"
          :rows="share(audience.followers)"
          unit="stargazer"
        />
        <BarList
          v-if="activity"
          title="Contributions in the past year"
          :note="`Of ${profiles(activity.size)}, as counted on GitHub`"
          :rows="withShare(activity.contributions, activity.size)"
          unit="stargazer"
          empty="GitHub couldn’t count contributions for this sample."
        />
        <div v-else class="panel-pending">
          <h3>Contributions in the past year</h3>
          <template v-if="activityError">
            <p>{{ activityError }}</p>
            <button class="btn btn-ghost" @click="loadActivity()">Try again</button>
          </template>
          <template v-else>
            <div class="progress" :style="{ '--progress': activityProgress.total ? activityProgress.done / activityProgress.total : 0 }"><span></span></div>
            <p>Counting contributions · {{ formatNumber(activityProgress.done) }} of {{ formatNumber(activityProgress.total) }}</p>
          </template>
        </div>
        <BarList
          title="Last pushed code"
          :note="`${formatNumber(audience.pushed)} of ${formatNumber(audience.size)} own a repository`"
          :rows="withShare(audience.pushes, audience.pushed)"
          unit="stargazer"
          empty="No stargazer in the sample owns a repository."
        />
      </div>

      <p class="footnote">
        Read from public GitHub profiles. Locations are matched to countries from free text, so some can't be placed;
        contributions include private ones only for people who chose to show them.
        <template v-if="audience.deleted">{{ formatNumber(audience.deleted) }} sampled accounts have since been deleted.</template>
        This browser keeps profiles for 30 days, follower and push counts for a day and contribution counts for a week<template v-if="fetched < audience.size + audience.deleted">; {{ formatNumber(audience.size + audience.deleted - fetched) }} of these profiles came from it</template>.
      </p>
    </template>

    <p v-else class="state">None of the sampled stargazers has a public profile left.</p>
  </section>

  <!-- Sits under the trend on wide screens and follows its zoom: who starred in that period. -->
  <section v-if="audience?.size" class="card audience-more" aria-label="Stargazer sign-ups and most-followed stargazers">
    <header class="period">
      <p v-if="range">
        <strong>Starred {{ formatDate(range.from) }} – {{ formatDate(range.to - 1) }}</strong>
        <template v-if="period"> · {{ formatNumber(period.stars) }} star{{ period.stars === 1 ? '' : 's' }}</template>
      </p>
      <p v-else>
        <strong>All time</strong> · zoom the chart to see who starred in a period
      </p>
      <button v-if="range" class="btn btn-ghost btn-small" @click="$emit('reset-range')">Show all time</button>
    </header>

    <div v-if="range && periodError" class="state">
      <p>{{ periodError }}</p>
      <button class="btn btn-ghost" @click="loadPeriod()">Try again</button>
    </div>

    <div v-else-if="!view" class="loading">
      <div class="progress" :style="{ '--progress': periodProgress.total ? periodProgress.done / periodProgress.total : 0 }"><span></span></div>
      <p>{{ periodProgress.total ? `Reading profiles for this period · ${formatNumber(periodProgress.done)} of ${formatNumber(periodProgress.total)}` : 'Reading profiles for this period…' }}</p>
    </div>

    <template v-else-if="view.size">
      <ColumnChart
        title="Joined GitHub"
        :note="view.note"
        :rows="withShare(view.joined, view.size)"
        unit="stargazer"
      />
      <div class="notable">
        <h3>Most-followed stargazers{{ range ? ' in this period' : '' }}</h3>
        <ul>
          <li v-for="p in view.notable" :key="p.login">
            <a :href="p.url" target="_blank" rel="noopener" :title="p.name ? `${p.name} (@${p.login})` : `@${p.login}`">
              <img :src="p.avatarUrl" alt="" width="32" height="32" loading="lazy" />
              <span class="notable-text">
                <span class="notable-login">{{ p.login }}</span>
                <span class="notable-meta">{{ formatCompact(p.followers) }} followers</span>
              </span>
            </a>
          </li>
        </ul>
      </div>
    </template>

    <p v-else class="state">{{ period?.stars ? 'None of the people who starred in this period has a public profile left.' : 'Nobody starred in this period.' }}</p>
  </section>
</template>

<script setup>
import { computed, ref, shallowRef, watch } from 'vue'
import BarList from './BarList.vue'
import ColumnChart from './ColumnChart.vue'
import { GitHubError } from '../github/api/v3'
import { getToken } from '../github/token'
import { analyzeActivity, analyzeAudience, joinedByYear, mostFollowed, sampleEvenly } from '../lib/audience'
import { loadContributions, loadProfiles } from '../lib/profiles'
import { formatCompact, formatDate, formatNumber } from '../lib/series'

// 10 GraphQL queries of 100 profiles: enough for stable shares, cheap on the rate limit.
const SAMPLE_SIZE = 1000
// Contribution counts are costly for GitHub to compute, so they come from a smaller
// even sub-sample (12 queries of 25), still within about ±6% at 95% confidence.
const ACTIVITY_SAMPLE_SIZE = 300
const TOP = 8
// A zoomed period reuses the overall sample when it holds this many of its stargazers.
const PERIOD_REUSE_MIN = 500
// Let the chart's zoom settle before reading profiles for the new period.
const PERIOD_DEBOUNCE = 400

const props = defineProps({
  repo: { type: String, required: true },
  // `[{ starredAt, id }]` from fetchStargazers; `null` while the list is still loading
  stargazers: { type: Array, default: null },
  // `{ from, to }` zoomed into on the chart (to exclusive), `null` for all time
  range: { type: Object, default: null },
})

defineEmits(['reset-range'])

const audience = shallowRef(null)
const activity = shallowRef(null)
const error = ref(null)
const activityError = ref(null)
const progress = ref({ done: 0, total: 0 })
const activityProgress = ref({ done: 0, total: 0 })
// how many sampled profiles had to be fetched rather than read from the browser cache
const fetched = ref(0)
// the overall sample, and the IDs in it whose accounts still exist
let sample = []
let audienceSample = []
let loadId = 0

// who starred in the zoomed period: `{ stars, size, joined, notable, note }`
const period = shallowRef(null)
const periodError = ref(null)
const periodProgress = ref({ done: 0, total: 0 })
let periodId = 0
let periodTimer = null

const view = computed(() => {
  if (props.range) return period.value
  const a = audience.value
  return a && {
    size: a.size,
    joined: a.joined,
    notable: a.notable,
    note: `Sign-up year of all ${profiles(a.size, 'sampled profile')}`,
  }
})

const sampled = computed(() => audience.value && props.stargazers.length > SAMPLE_SIZE)

const progressText = computed(() => {
  if (!props.stargazers) return 'Waiting for the stargazer list…'
  const { done, total } = progress.value
  return total
    ? `Reading stargazer profiles · ${formatNumber(done)} of ${formatNumber(total)}`
    : 'Reading stargazer profiles…'
})

const percent = (count, of = audience.value.size) => {
  const ratio = count / of
  return `${ratio > 0 && ratio < 0.01 ? '<1' : Math.round(ratio * 100)}%`
}

const profiles = (n, noun = 'profile') => `${formatNumber(n)} ${noun}${n === 1 ? '' : 's'}`

const formatYears = (years) => (years < 1 ? `${Math.max(1, Math.round(years * 12))} mo` : `${years.toFixed(1)} yrs`)

const withShare = (rows, of) => rows.map((r) => ({ ...r, share: of ? r.count / of : 0 }))

/**
 * The leading rows of a ranking, with everything else folded into "others".
 * One-offs are folded too once anything repeats, so a long tail of single
 * entries doesn't pose as a ranking.
 */
function top(rows, of) {
  const repeated = rows.findIndex((r) => r.count < 2)
  const shown = Math.min(TOP, repeated > 0 ? repeated : rows.length)
  if (rows.length <= shown + 1) return withShare(rows, of)
  const rest = rows.slice(shown).reduce((sum, r) => sum + r.count, 0)
  return [...withShare(rows.slice(0, shown), of), { label: `${formatNumber(rows.length - shown)} others`, count: rest, share: rest / of, other: true }]
}

const share = (rows) => withShare(rows, audience.value.size)

function describe(e, what) {
  if (e instanceof GitHubError && (e.status === 403 || e.status === 429)) return `GitHub is throttling ${what} for this token. Wait a few minutes and try again.`
  if (e instanceof GitHubError && e.status === 401) return 'GitHub rejected the access token. Update it in settings and try again.'
  if (e instanceof GitHubError) return `GitHub returned an error: ${e.message}`
  return 'Couldn’t reach GitHub. Check your connection and try again.'
}

async function load() {
  const id = ++loadId
  error.value = null
  activityError.value = null
  progress.value = { done: 0, total: 0 }
  audience.value = null
  activity.value = null
  if (!props.stargazers) return

  sample = sampleEvenly(props.stargazers.filter((s) => s.id), SAMPLE_SIZE)
  try {
    const { profiles, fetched: count } = await loadProfiles(sample.map((s) => s.id), getToken(), (done, total) => {
      if (id === loadId) progress.value = { done, total }
    })
    if (id !== loadId) return
    audienceSample = sample.filter((_, i) => profiles[i]).map((s) => s.id)
    fetched.value = count
    audience.value = analyzeAudience(sample.map((s, i) => ({ starredAt: s.starredAt, profile: profiles[i] })))
  } catch (e) {
    if (id === loadId) error.value = describe(e, 'profile lookups')
    return
  }
  if (props.range) loadPeriod()
  loadActivity()
}

/**
 * Reads the profiles of people who starred within `range`: all of them when there are
 * few enough, else the overall sample's share of the period when that is large
 * enough, else a fresh even sample of the period (mostly cached on a revisit).
 */
async function loadPeriod() {
  const id = ++periodId
  const range = props.range
  period.value = null
  periodError.value = null
  periodProgress.value = { done: 0, total: 0 }
  if (!range || !props.stargazers || !audience.value) return

  const inside = (s) => {
    const t = Date.parse(s.starredAt)
    return t >= range.from && t < range.to
  }
  const starred = props.stargazers.filter(inside)
  const candidates = starred.filter((s) => s.id)
  const reused = sample.filter(inside)
  const picked = candidates.length <= SAMPLE_SIZE ? candidates
    : reused.length >= PERIOD_REUSE_MIN ? reused
      : sampleEvenly(candidates, SAMPLE_SIZE)

  try {
    const { profiles: found } = await loadProfiles(picked.map((s) => s.id), getToken(), (done, total) => {
      if (id === periodId) periodProgress.value = { done, total }
    })
    if (id !== periodId) return
    const people = found.filter(Boolean)
    period.value = {
      stars: starred.length,
      size: people.length,
      joined: joinedByYear(people, range.to),
      notable: mostFollowed(people),
      note: picked.length < candidates.length
        ? `Sign-up year of ${profiles(people.length, 'sampled profile')} who starred in this period`
        : `Sign-up year of all ${profiles(people.length)} who starred in this period`,
    }
  } catch (e) {
    if (id === periodId) periodError.value = describe(e, 'profile lookups')
  }
}

watch(() => props.range, () => {
  clearTimeout(periodTimer)
  periodId++
  period.value = null
  periodError.value = null
  periodProgress.value = { done: 0, total: 0 }
  if (props.range) periodTimer = setTimeout(loadPeriod, PERIOD_DEBOUNCE)
})

// Contribution counts are slow for GitHub to compute, so they load after the
// profiles are already on screen.
async function loadActivity() {
  const id = loadId
  const ids = sampleEvenly(audienceSample, ACTIVITY_SAMPLE_SIZE)
  activityError.value = null
  activityProgress.value = { done: 0, total: 0 }
  try {
    const counts = await loadContributions(ids, getToken(), (done, total) => {
      if (id === loadId) activityProgress.value = { done, total }
    })
    if (id !== loadId) return
    activity.value = analyzeActivity(counts)
  } catch (e) {
    if (id === loadId) activityError.value = describe(e, 'contribution lookups')
  }
}

watch(() => props.stargazers, () => load(), { immediate: true })
</script>

<style scoped>
/* Layout follows each card's own width, so it works beside the chart or below it. */
.audience, .audience-more { container-type: inline-size; overflow: hidden; }

.audience-head { padding: 22px 24px 18px; }
.audience-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.015em;
}
.audience-sub {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--muted);
  text-wrap: pretty;
}

.figures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.figure { padding: 14px 24px; min-width: 0; }
.figure:nth-child(even) { border-left: 1px solid var(--border); }
.figure:nth-child(n + 3) { border-top: 1px solid var(--border); }
.figures dt { font-size: 13px; font-weight: 550; color: var(--muted); }
.figures dd { margin: 0; }
.figures dd:not(.figure-sub) {
  margin-top: 2px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
}
.figure-sub {
  min-height: 1.5em;
  font-size: 12.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 1px gaps over the border color draw the hairlines between panels, whatever they span */
.panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1px;
  background: var(--border);
}
.panels > * { background: var(--surface); }

.panel-pending { padding: 18px 24px 20px; min-width: 0; }
.panel-pending h3 { margin: 0 0 16px; font-size: 13px; font-weight: 600; color: var(--text-2); }
.panel-pending p { margin: 10px 0 12px; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.panel-pending .progress { width: min(240px, 100%); }

.period {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  min-height: 52px;
  padding: 10px 24px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  color: var(--muted);
}
.period p { margin: 0; text-wrap: pretty; }
.period strong { color: var(--text); font-weight: 600; }
.btn-small { flex: none; height: 30px; padding: 0 12px; font-size: 13px; }
.period + .loading, .period + .state { border-top: 0; }

.notable { padding: 20px 24px 8px; border-top: 1px solid var(--border); }
.notable h3 { margin: 0 0 12px; font-size: 13px; font-weight: 600; color: var(--text-2); }
.notable ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 4px 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.notable a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  margin: 0 -8px;
  border-radius: 10px;
  text-decoration: none;
  transition: background-color .15s;
}
.notable a:hover { background: var(--surface-2); }
.notable img {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-2);
}
.notable-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.notable-login { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.notable-meta { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }

.footnote { margin: 0; padding: 12px 24px 18px; font-size: 12.5px; color: var(--muted); text-wrap: pretty; }

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 220px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.loading p { margin: 0; }
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

.state {
  margin: 0;
  padding: 32px 24px;
  border-top: 1px solid var(--border);
  text-align: center;
  color: var(--text-2);
}
.state p { margin: 0 auto 16px; max-width: 440px; }

.skeleton-num {
  display: inline-block;
  width: 56px;
  height: 22px;
  border-radius: 6px;
  vertical-align: middle;
  background: linear-gradient(90deg, var(--surface-2), var(--border), var(--surface-2));
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

@container (min-width: 520px) {
  .panels { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .panel-pending { padding: 18px 20px 20px; }
}

@container (min-width: 760px) {
  .figures { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .figure:nth-child(n) { border-top: 0; border-left: 1px solid var(--border); }
  .figure:first-child { border-left: 0; }
  .panel-pending { padding: 18px 24px 20px; }
}

@container (max-width: 519px) {
  .audience-head { padding: 20px 16px 14px; }
  .figures { grid-template-columns: 1fr; }
  .figure { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 10px 16px; }
  .figure:nth-child(n) { border-left: 0; }
  .figure + .figure { border-top: 1px solid var(--border); }
  .figures dt { flex: 1; }
  .figures dd:not(.figure-sub) { font-size: 16px; }
  .figure-sub { display: none; }
  .panel-pending { padding: 16px; }
  .period { padding: 10px 16px; }
  .notable { padding: 16px 16px 4px; }
  .notable ul { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .notable a { margin: 0 -6px; padding: 6px; }
  .footnote { padding: 12px 16px 16px; }
}
</style>
