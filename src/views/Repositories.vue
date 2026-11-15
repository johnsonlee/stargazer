<template>
  <section class="container repos">
    <header class="repos-head">
      <h1>Repositories</h1>
      <p class="subtitle">
        <template v-if="user">Signed in as @{{ user.login }}</template>
        <span v-else-if="!error" class="skeleton-text"></span>
      </p>
    </header>

    <div v-if="error" class="card state state-error">
      <h2>{{ error.title }}</h2>
      <p>{{ error.detail }}</p>
      <button class="btn btn-ghost" @click="load(true)">Try again</button>
    </div>

    <template v-else>
      <section v-if="pinned.length" class="pinned" aria-labelledby="pinned-title">
        <h2 id="pinned-title" class="section-title">Pinned</h2>
        <div class="pinned-grid">
          <RouterLink v-for="repo in pinned" :key="repo.id" class="card pin-card" :to="`/${repo.full_name}`">
            <div class="pin-card-head">
              <img class="owner-avatar" :class="{ org: repo.owner.type === 'Organization' }" :src="avatarUrl(repo.owner.avatar_url, 40)" alt="" width="20" height="20" />
              <span class="pin-card-name"><span class="pin-card-owner">{{ repo.owner.login }}/</span>{{ repo.name }}</span>
              <Icon v-if="repo.private" name="lock" :size="13" class="lock" aria-label="Private" />
            </div>
            <p class="pin-card-desc">{{ repo.description || 'No description' }}</p>
            <div class="pin-card-foot">
              <span class="row-stars"><Icon name="star" :size="13" />{{ formatNumber(repo.stargazers_count) }}</span>
              <span v-if="repo.language" class="pin-card-lang">{{ repo.language }}</span>
            </div>
            <button type="button" class="pin-btn is-pinned" title="Unpin" :aria-label="`Unpin ${repo.full_name}`" @click.prevent.stop="togglePin(repo.full_name)">
              <Icon name="pin" :size="15" />
            </button>
          </RouterLink>
        </div>
      </section>

      <nav class="owners" aria-label="Owner">
        <template v-if="!repos">
          <span v-for="i in 3" :key="i" class="owner owner-skeleton skeleton"></span>
        </template>
        <button
          v-for="o in owners"
          v-else
          :key="o.login"
          type="button"
          class="owner"
          :class="{ active: o.login === owner }"
          :aria-pressed="o.login === owner"
          @click="selectOwner(o.login)"
        >
          <img class="owner-avatar" :class="{ org: o.type === 'Organization' }" :src="avatarUrl(o.avatar_url, 40)" alt="" width="20" height="20" />
          <span class="owner-login">{{ o.login }}</span>
          <span class="owner-count">{{ formatNumber(query ? o.matches : o.count) }}</span>
        </button>
      </nav>

      <div class="toolbar">
        <label class="search">
          <input v-model="query" type="search" :placeholder="owner ? `Filter ${owner}’s repositories` : 'Filter repositories'" aria-label="Filter repositories" spellcheck="false" />
        </label>
        <div class="segmented" role="radiogroup" aria-label="Sort by" :style="{ '--index': SORTS.findIndex((it) => it.value === sort) }">
          <span class="segmented-thumb" aria-hidden="true"></span>
          <button
            v-for="it in SORTS"
            :key="it.value"
            type="button"
            role="radio"
            :aria-checked="it.value === sort"
            :class="{ active: it.value === sort }"
            @click="sort = it.value"
          >
            {{ it.label }}
          </button>
        </div>
      </div>

      <ul class="card list">
        <template v-if="!repos">
          <li v-for="i in 6" :key="i" class="row row-skeleton">
            <span class="skeleton-text" :style="{ width: `${30 + (i * 13) % 40}%` }"></span>
          </li>
        </template>
        <li v-for="repo in visible" v-else :key="repo.id">
          <RouterLink class="row" :class="{ archived: repo.archived }" :to="`/${repo.full_name}`">
            <div class="row-main">
              <div class="row-name">
                <span class="name">{{ repo.name }}</span>
                <Icon v-if="repo.private" name="lock" :size="13" class="lock" aria-label="Private" />
              </div>
              <p v-if="repo.description" class="row-desc">{{ repo.description }}</p>
              <p class="row-meta">
                <span v-for="(item, i) in metaOf(repo)" :key="i">{{ item }}</span>
              </p>
            </div>
            <span class="row-stars" :aria-label="`${formatNumber(repo.stargazers_count)} stars`">
              <Icon name="star" :size="13" />{{ formatNumber(repo.stargazers_count) }}
            </span>
            <button
              type="button"
              class="pin-btn"
              :class="{ 'is-pinned': isPinned(repo.full_name) }"
              :title="isPinned(repo.full_name) ? 'Unpin' : 'Pin to top'"
              :aria-label="`${isPinned(repo.full_name) ? 'Unpin' : 'Pin'} ${repo.full_name}`"
              :aria-pressed="isPinned(repo.full_name)"
              @click.prevent.stop="togglePin(repo.full_name)"
            >
              <Icon name="pin" :size="15" />
            </button>
          </RouterLink>
        </li>
        <li v-if="repos && !visible.length" class="empty">
          <template v-if="query">
            No repositories in {{ owner }} match “{{ query }}”.
            <template v-if="elsewhere"> {{ formatNumber(elsewhere) }} {{ elsewhere === 1 ? 'match' : 'matches' }} under other owners.</template>
          </template>
          <template v-else>This token can’t see any repositories yet.</template>
        </li>
      </ul>

      <p class="hint">Looking for someone else’s repository? Enter <code>owner/repository</code> in the search bar above.</p>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import { fetchUser, fetchUserRepos, GitHubError } from '../github/api/v3'
import { getToken } from '../github/token'
import { formatNumber } from '../lib/series'
import { isPinned, pins, togglePin } from '../lib/pins'

const SORTS = [
  { value: 'stars', label: 'Stars' },
  { value: 'recent', label: 'Recent' },
  { value: 'name', label: 'Name' },
]

// Kept for the session (per token) so returning from a chart is instant.
let cache = null

const route = useRoute()
const router = useRouter()
const user = shallowRef(null)
const repos = shallowRef(null)
const error = ref(null)
const query = ref('')
const sort = ref('stars')

function matches(repo, q) {
  return !q || repo.name.toLowerCase().includes(q) || (repo.description || '').toLowerCase().includes(q)
}

const normalizedQuery = computed(() => query.value.trim().toLowerCase())

// The signed-in user first, then organizations/other owners by repository count.
const owners = computed(() => {
  if (!repos.value) return []
  const byLogin = new Map()
  for (const repo of repos.value) {
    const o = byLogin.get(repo.owner.login) || { ...repo.owner, count: 0, matches: 0 }
    o.count += 1
    if (matches(repo, normalizedQuery.value)) o.matches += 1
    byLogin.set(repo.owner.login, o)
  }
  const self = user.value?.login
  return [...byLogin.values()].sort((a, b) => (b.login === self) - (a.login === self)
    || b.count - a.count
    || a.login.localeCompare(b.login))
})

const owner = computed(() => {
  const requested = route.query.owner
  return owners.value.some((o) => o.login === requested) ? requested : owners.value[0]?.login
})

function selectOwner(login) {
  router.replace({ query: login === owners.value[0]?.login ? {} : { owner: login } })
}

const visible = computed(() => {
  if (!repos.value) return []
  const q = normalizedQuery.value
  const by = {
    stars: (a, b) => b.stargazers_count - a.stargazers_count || a.name.localeCompare(b.name),
    recent: (a, b) => Date.parse(b.pushed_at || b.updated_at) - Date.parse(a.pushed_at || a.updated_at),
    name: (a, b) => a.name.localeCompare(b.name),
  }
  return repos.value
    .filter((r) => r.owner.login === owner.value && matches(r, q))
    .sort(by[sort.value])
})

const elsewhere = computed(() => owners.value
  .filter((o) => o.login !== owner.value)
  .reduce((sum, o) => sum + o.matches, 0))

// Pinned repositories in pin order; pins the token can no longer see are skipped.
const pinned = computed(() => {
  if (!repos.value) return []
  const byName = new Map(repos.value.map((r) => [r.full_name, r]))
  return pins.value.map((name) => byName.get(name)).filter(Boolean)
})

// GitHub lists who starred a repository only to its admins and collaborators;
// elsewhere only the star trend can be shown.
const trendOnly = (repo) => repo.permissions && !repo.permissions.admin && !repo.permissions.push

function metaOf(repo) {
  return [
    repo.language,
    repo.fork && 'Fork',
    repo.archived && 'Archived',
    trendOnly(repo) && 'Trend only',
    relativeTime(repo.pushed_at || repo.updated_at),
  ].filter(Boolean)
}

function avatarUrl(raw, size = 96) {
  const url = new URL(raw)
  url.searchParams.set('s', String(size))
  return url.href
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const UNITS = [['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60]]

function relativeTime(value) {
  const seconds = (Date.parse(value) - Date.now()) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return `Updated ${relative.format(Math.round(seconds / size), unit)}`
  }
  return 'Updated just now'
}

async function load(force = false) {
  const token = getToken()
  error.value = null
  if (!force && cache?.token === token) {
    user.value = cache.user
    repos.value = cache.repos
    return
  }
  user.value = null
  repos.value = null
  try {
    const [u, r] = await Promise.all([fetchUser(token), fetchUserRepos(token)])
    cache = { token, user: u, repos: r }
    user.value = u
    repos.value = r
  } catch (e) {
    if (e instanceof GitHubError && e.status === 401) {
      router.replace({ name: 'settings', query: { redirect: route.fullPath, error: 'unauthorized' } })
      return
    }
    error.value = e instanceof GitHubError
      ? { title: 'GitHub returned an error', detail: e.message }
      : { title: 'Couldn’t reach GitHub', detail: 'Check your connection and try again.' }
  }
}

load()
</script>

<style scoped>
.repos { max-width: 880px; padding-top: 40px; padding-bottom: 64px; }

.repos-head { margin-bottom: 20px; }

h1 { margin: 0; font-size: 26px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.25; }

.subtitle { margin: 4px 0 0; min-height: 1.5em; color: var(--muted); font-size: 14px; }

.section-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}

.pinned { margin-bottom: 28px; }

.pinned-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.pin-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 14px 16px;
  text-decoration: none;
  transition: border-color .15s, transform .15s;
}
.pin-card:hover { border-color: var(--axis); transform: translateY(-1px); }
.pin-card:hover .pin-card-name { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }

.pin-card-head { display: flex; align-items: center; gap: 8px; min-width: 0; padding-right: 28px; }

.pin-card-name {
  min-width: 0;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pin-card-owner { color: var(--muted); font-weight: 500; }

.pin-card-desc {
  flex: 1;
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.9em;
}

.pin-card-foot { display: flex; align-items: center; gap: 14px; font-size: 13px; }
.pin-card-lang { color: var(--muted); }

.pin-card .pin-btn { position: absolute; top: 10px; right: 10px; }

.pin-btn {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  margin: -3px -6px 0 0;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity .12s, color .12s, background-color .12s;
}
.row:hover .pin-btn, .pin-btn:focus-visible, .pin-btn.is-pinned { opacity: 1; }
.pin-btn:hover { color: var(--text); background: var(--border); }
.pin-btn.is-pinned { color: var(--text); }
.pin-btn.is-pinned :deep(path) { fill: currentColor; }
.pin-card .pin-btn { margin: 0; }

@media (hover: none) {
  .pin-btn { opacity: 1; }
}

.owners {
  display: flex;
  gap: 6px;
  margin: 0 -16px 16px;
  padding: 0 16px 2px;
  overflow-x: auto;
  scrollbar-width: none;
}
.owners::-webkit-scrollbar { display: none; }

.owner {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px 0 8px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  font-size: 13.5px;
  font-weight: 550;
  color: var(--text-2);
  cursor: pointer;
  transition: border-color .15s, background-color .15s, color .15s;
}
.owner:hover { color: var(--text); border-color: var(--axis); }
.owner.active { background: var(--text); border-color: var(--text); color: var(--bg); }

.owner-avatar { width: 20px; height: 20px; border-radius: 50%; background: var(--surface-2); }
.owner-avatar.org { border-radius: 5px; }

.owner-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}
.owner.active .owner-count { background: color-mix(in srgb, var(--bg) 18%, transparent); color: var(--bg); }

.owner-skeleton { width: 110px; border: 0; }

.toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }

.search { flex: 1; min-width: 200px; }

.search input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  outline: none;
  font-size: 14px;
  transition: border-color .15s, box-shadow .15s;
}
.search input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-ring); }
.search input::placeholder { color: var(--muted); }

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
  height: 32px;
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

.list { margin: 0; padding: 0; list-style: none; overflow: hidden; }
.list > li + li { border-top: 1px solid var(--border); }

.row {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 16px 20px;
  text-decoration: none;
  transition: background-color .12s;
}
a.row:hover { background: var(--surface-2); }
a.row:hover .name { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.row.archived .name, .row.archived .row-desc { color: var(--muted); }

.row-main { flex: 1; min-width: 0; }

.row-name { display: flex; align-items: center; gap: 6px; min-width: 0; }

.name {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lock { color: var(--muted); }

.row-desc {
  margin: 4px 0 0;
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.row-meta {
  display: flex;
  flex-wrap: wrap;
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--muted);
}
.row-meta span + span::before { content: "·"; margin: 0 7px; }

.row-stars {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  padding-top: 1px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.row-stars .icon { color: var(--muted); }

.row-skeleton { height: 84px; padding: 18px 20px; }

.empty { padding: 32px 20px; text-align: center; color: var(--muted); }

.hint { margin: 16px 0 0; font-size: 13px; color: var(--muted); text-align: center; }

code {
  font-family: var(--mono);
  font-size: .9em;
  padding: 1px 5px;
  border-radius: 5px;
  background: var(--surface-2);
}

.state { padding: 40px 24px; text-align: center; }
.state h2 { margin: 0 0 6px; font-size: 18px; color: var(--danger); }
.state p { margin: 0 auto 20px; max-width: 440px; color: var(--text-2); }

.skeleton, .skeleton-text {
  background: linear-gradient(90deg, var(--surface-2), var(--border), var(--surface-2));
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
.skeleton-text { display: inline-block; height: 13px; width: 140px; border-radius: 6px; vertical-align: middle; }

@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

@media (max-width: 559px) {
  .repos { padding-top: 24px; }
  .search { flex-basis: 100%; }
  .segmented { flex: 1; }
  .segmented button { min-width: 0; }
  .row { padding: 14px 16px; gap: 12px; }
  .pinned-grid { grid-template-columns: 1fr; }
}
</style>
