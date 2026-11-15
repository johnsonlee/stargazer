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
      <button class="btn btn-ghost" @click="load(true)">Try again</button>
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
          <dt>Share a location</dt>
          <dd>{{ percent(audience.located) }}</dd>
          <dd class="figure-sub">{{ formatNumber(audience.countries.length) }} countries and regions</dd>
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
          :note="`Of ${formatNumber(audience.recognized)} with a recognizable location`"
          :rows="top(audience.countries, audience.recognized)"
          unit="stargazer"
          empty="No stargazer in the sample lists a recognizable location."
        />
        <BarList
          title="Companies"
          :note="`Of ${formatNumber(audience.employed)} who list a company`"
          :rows="top(audience.companies, audience.employed)"
          unit="stargazer"
          empty="No stargazer in the sample lists a company."
        />
        <BarList
          title="Followers"
          :note="`Of all ${formatNumber(audience.size)} profiles`"
          :rows="share(audience.followers)"
          unit="stargazer"
        />
        <BarList
          title="Account age when starring"
          :note="`Of all ${formatNumber(audience.size)} profiles`"
          :rows="share(audience.ages)"
          unit="stargazer"
        />
      </div>

      <div class="notable">
        <h3>Most-followed stargazers</h3>
        <ul>
          <li v-for="p in audience.notable" :key="p.login">
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

      <p class="footnote">
        Read from public GitHub profiles; locations are matched to countries from free text, so some can't be placed.
        <template v-if="audience.deleted">{{ formatNumber(audience.deleted) }} sampled accounts have since been deleted.</template>
      </p>
    </template>

    <p v-else class="state">None of the sampled stargazers has a public profile left.</p>
  </section>
</template>

<script setup>
import { computed, ref, shallowRef, watch } from 'vue'
import BarList from './BarList.vue'
import { GitHubError } from '../github/api/v3'
import { fetchUsers } from '../github/api/v4'
import { getToken } from '../github/token'
import { analyzeAudience, sampleEvenly } from '../lib/audience'
import { formatCompact, formatNumber } from '../lib/series'

// 10 GraphQL queries of 100 profiles: enough for stable shares, cheap on the rate limit.
const SAMPLE_SIZE = 1000
const TOP = 8

const props = defineProps({
  repo: { type: String, required: true },
  // `[{ starredAt, id }]` from fetchStargazers
  stargazers: { type: Array, required: true },
})

// Profiles change slowly; keep them for the session like the stargazer lists.
const cache = new Map()

const audience = shallowRef(null)
const error = ref(null)
const progress = ref({ done: 0, total: 0 })
let loadId = 0

const sampled = computed(() => audience.value && props.stargazers.length > SAMPLE_SIZE)

const progressText = computed(() => {
  const { done, total } = progress.value
  return total > 1
    ? `Reading stargazer profiles · ${formatNumber(Math.min(done * 100, SAMPLE_SIZE))} of ${formatNumber(Math.min(props.stargazers.length, SAMPLE_SIZE))}`
    : 'Reading stargazer profiles…'
})

const percent = (count) => {
  const ratio = count / audience.value.size
  return `${ratio > 0 && ratio < 0.01 ? '<1' : Math.round(ratio * 100)}%`
}

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

async function load(force = false) {
  const id = ++loadId
  const key = props.repo.toLowerCase()
  error.value = null
  progress.value = { done: 0, total: 0 }
  audience.value = (!force && cache.get(key)) || null
  if (audience.value) return

  const sample = sampleEvenly(props.stargazers.filter((s) => s.id), SAMPLE_SIZE)
  try {
    const profiles = await fetchUsers(sample.map((s) => s.id), getToken(), (done, total) => {
      if (id === loadId) progress.value = { done, total }
    })
    if (id !== loadId) return
    const result = analyzeAudience(sample.map((s, i) => ({ starredAt: s.starredAt, profile: profiles[i] })))
    cache.set(key, result)
    audience.value = result
  } catch (e) {
    if (id !== loadId) return
    if (e instanceof GitHubError && (e.status === 403 || e.status === 429)) error.value = 'GitHub is throttling profile lookups for this token. Wait a few minutes and try again.'
    else if (e instanceof GitHubError && e.status === 401) error.value = 'GitHub rejected the access token. Update it in settings and try again.'
    else if (e instanceof GitHubError) error.value = `GitHub returned an error: ${e.message}`
    else error.value = 'Couldn’t reach GitHub. Check your connection and try again.'
  }
}

watch(() => props.stargazers, () => load(), { immediate: true })
</script>

<style scoped>
.audience { margin-top: 16px; overflow: hidden; }

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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.figure { padding: 14px 24px; min-width: 0; }
.figure + .figure { border-left: 1px solid var(--border); }
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
  font-size: 12.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.panels > :nth-child(even) { border-left: 1px solid var(--border); }
.panels > :nth-child(n + 3) { border-top: 1px solid var(--border); }

.notable { padding: 20px 24px 8px; border-top: 1px solid var(--border); }
.notable h3 { margin: 0 0 12px; font-size: 13px; font-weight: 600; color: var(--text-2); }
.notable ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
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

.footnote { margin: 0; padding: 12px 24px 18px; font-size: 12.5px; color: var(--muted); }

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

@media (max-width: 879px) {
  .figures { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .figure:nth-child(3) { border-left: 0; }
  .figure:nth-child(n + 3) { border-top: 1px solid var(--border); }
}

@media (max-width: 719px) {
  .panels { grid-template-columns: minmax(0, 1fr); }
  .panels > :nth-child(even) { border-left: 0; }
  .panels > :nth-child(n + 2) { border-top: 1px solid var(--border); }
}

@media (max-width: 559px) {
  .audience-head { padding: 20px 16px 14px; }
  .figures { grid-template-columns: 1fr; }
  .figure { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 10px 16px; }
  .figure + .figure { border-left: 0; border-top: 1px solid var(--border); }
  .figures dt { flex: 1; }
  .figures dd:not(.figure-sub) { font-size: 16px; }
  .figure-sub { display: none; }
  .notable { padding: 16px 16px 4px; }
  .notable ul { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .notable a { margin: 0 -6px; padding: 6px; }
  .footnote { padding: 12px 16px 16px; }
}
</style>
