// Stargazer profiles, cached per user in this browser with a TTL per kind of data, so
// revisiting a repository (or another one starred by the same people) skips most queries.
import { fetchContributions, fetchUsers, fetchUserStats } from '../github/api/v4'
import { USERS, getMany, prune, putMany } from './store'

const DAY = 24 * 3600 * 1000

// Location, company, sign-up date, name and avatar rarely change.
export const IDENTITY_TTL = 30 * DAY
// Followers, repository count and last push move day to day.
export const STATS_TTL = DAY
// Past-year contribution totals shift slowly and are the costliest to compute.
export const CONTRIBUTIONS_TTL = 7 * DAY

const fresh = (at, ttl, now) => at != null && now - at < ttl

let pruned = false

// Drops users nobody has looked at for longer than the longest TTL; once per session.
function pruneOnce(now) {
  if (pruned) return
  pruned = true
  prune(USERS, (r) => now - Math.max(r.identityAt ?? 0, r.statsAt ?? 0, r.contributionsAt ?? 0) > IDENTITY_TTL)
}

/**
 * Profiles for user node IDs, aligned with `ids` (`null` for deleted accounts), merged
 * from the cache and whatever had to be fetched. `onProgress(done, total)` counts the
 * users fetched; `fetched` in the result says how many were not served from the cache.
 */
export async function loadProfiles(ids, token, onProgress = () => {}, now = Date.now()) {
  pruneOnce(now)
  const records = await getMany(USERS, ids)
  // a deleted account is remembered as `identity: null` for as long as an identity
  const needFull = ids.filter((id) => !fresh(records.get(id)?.identityAt, IDENTITY_TTL, now))
  const needStats = ids.filter((id) => {
    const r = records.get(id)
    return r?.identity && fresh(r.identityAt, IDENTITY_TTL, now) && !fresh(r.statsAt, STATS_TTL, now)
  })

  const total = needFull.length + needStats.length
  onProgress(0, total)
  const changed = new Map()

  if (needFull.length) {
    const users = await fetchUsers(needFull, token, (done) => onProgress(done, total))
    needFull.forEach((id, i) => {
      const record = { ...records.get(id), identity: users[i]?.identity ?? null, identityAt: now, stats: users[i]?.stats ?? null, statsAt: now }
      records.set(id, record)
      changed.set(id, record)
    })
  }
  if (needStats.length) {
    const stats = await fetchUserStats(needStats, token, (done) => onProgress(needFull.length + done, total))
    needStats.forEach((id, i) => {
      const record = stats[i]
        ? { ...records.get(id), stats: stats[i], statsAt: now }
        : { ...records.get(id), identity: null, identityAt: now, stats: null, statsAt: now }
      records.set(id, record)
      changed.set(id, record)
    })
  }
  await putMany(USERS, [...changed])

  return {
    profiles: ids.map((id) => {
      const r = records.get(id)
      return r?.identity ? { ...r.identity, ...r.stats } : null
    }),
    fetched: needFull.length + needStats.length,
  }
}

/**
 * Past-year contribution counts for user node IDs, aligned with `ids`; `null` where
 * GitHub couldn't tell. Counts GitHub couldn't compute are not cached, so they are
 * retried next time.
 */
export async function loadContributions(ids, token, onProgress = () => {}, now = Date.now()) {
  const records = await getMany(USERS, ids)
  const need = ids.filter((id) => !fresh(records.get(id)?.contributionsAt, CONTRIBUTIONS_TTL, now))
  onProgress(0, need.length)

  const counts = new Map(ids.map((id) => [id, records.get(id)?.contributions ?? null]))
  if (need.length) {
    const fetched = await fetchContributions(need, token, onProgress)
    const changed = []
    need.forEach((id, i) => {
      counts.set(id, fetched[i])
      if (fetched[i] != null) changed.push([id, { ...records.get(id), contributions: fetched[i], contributionsAt: now }])
    })
    await putMany(USERS, changed)
  }
  return ids.map((id) => counts.get(id))
}
