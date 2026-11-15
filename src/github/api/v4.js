import { GitHubError } from './v3'

const ENDPOINT = 'https://api.github.com/graphql'
// `nodes(ids:)` accepts at most 100 IDs per query.
const BATCH = 100
// GraphQL requests are heavier than REST pages; stay well under the secondary rate limit.
const CONCURRENCY = 4
// Contribution calendars are expensive to compute: around 40 per query GitHub answers
// RESOURCE_LIMITS_EXCEEDED, and many queries in parallel trip the secondary rate limit.
const CONTRIBUTION_BATCH = 25
const CONTRIBUTION_CONCURRENCY = 2

async function query(text, variables, token) {
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: text, variables }),
  })
  let body = null
  try {
    body = await resp.json()
  } catch {
    // non-JSON error body
  }
  if (!resp.ok) throw new GitHubError(resp.status, body?.message || resp.statusText)
  // Deleted accounts come back as NOT_FOUND errors next to partial data; only fail without data.
  if (!body?.data) {
    const error = body?.errors?.[0]
    throw new GitHubError(error?.type === 'RATE_LIMITED' ? 403 : 502, error?.message || 'Malformed GraphQL response')
  }
  return body.data
}

/**
 * Runs `run(batch)` over `ids` in batches with bounded concurrency and returns the
 * flattened results in input order. `onProgress(done, total)` counts IDs.
 */
async function inBatches(ids, size, concurrency, run, onProgress) {
  const batches = []
  for (let i = 0; i < ids.length; i += size) batches.push(ids.slice(i, i + size))
  const results = new Array(batches.length)

  let done = 0
  let next = 0
  onProgress(done, ids.length)

  async function worker() {
    while (next < batches.length) {
      const index = next++
      results[index] = await run(batches[index])
      done += batches[index].length
      onProgress(done, ids.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker))
  return results.flat()
}

// Followers, repositories and last push change often; the rest of a profile rarely does.
// They are queried together the first time and on their own afterwards, so cached
// profiles only need this lighter query to stay current.
const STATS_FIELDS = `
      followers { totalCount }
      repositories(first: 1, ownerAffiliations: OWNER, orderBy: { field: PUSHED_AT, direction: DESC }) {
        totalCount
        nodes { pushedAt }
      }`

const USERS = `query($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on User {
      login
      name
      avatarUrl(size: 64)
      url
      bio
      company
      location
      createdAt${STATS_FIELDS}
    }
  }
}`

const STATS = `query($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on User {
      login${STATS_FIELDS}
    }
  }
}`

const toStats = (u) => ({
  followers: u.followers.totalCount,
  repositories: u.repositories.totalCount,
  lastPushedAt: u.repositories.nodes[0]?.pushedAt ?? null,
})

/**
 * Fetches public profiles for the given user node IDs, 100 per query, as
 * `{ identity, stats }`. The result is aligned with `ids`; deleted accounts are `null`.
 */
export async function fetchUsers(ids, token, onProgress = () => {}) {
  const nodes = await inBatches(ids, BATCH, CONCURRENCY, async (batch) => (await query(USERS, { ids: batch }, token)).nodes, onProgress)
  return nodes.map((u) => (u?.login ? {
    identity: {
      login: u.login,
      name: u.name,
      avatarUrl: u.avatarUrl,
      url: u.url,
      bio: u.bio,
      company: u.company,
      location: u.location,
      createdAt: u.createdAt,
    },
    stats: toStats(u),
  } : null))
}

/**
 * Fetches only followers, repository count and last push for the given user node IDs.
 * The result is aligned with `ids`; deleted accounts are `null`.
 */
export async function fetchUserStats(ids, token, onProgress = () => {}) {
  const nodes = await inBatches(ids, BATCH, CONCURRENCY, async (batch) => (await query(STATS, { ids: batch }, token)).nodes, onProgress)
  return nodes.map((u) => (u?.login ? toStats(u) : null))
}

const CONTRIBUTIONS = `query($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on User {
      contributionsCollection { contributionCalendar { totalContributions } }
    }
  }
}`

/**
 * Fetches how many contributions each user made in the past year, as shown on their
 * profile. The result is aligned with `ids`; `null` where GitHub couldn't tell.
 */
export async function fetchContributions(ids, token, onProgress = () => {}) {
  const nodes = await inBatches(ids, CONTRIBUTION_BATCH, CONTRIBUTION_CONCURRENCY, async (batch) => (await query(CONTRIBUTIONS, { ids: batch }, token)).nodes, onProgress)
  return nodes.map((u) => u?.contributionsCollection?.contributionCalendar.totalContributions ?? null)
}
