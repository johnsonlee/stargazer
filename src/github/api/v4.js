import { GitHubError } from './v3'

const ENDPOINT = 'https://api.github.com/graphql'
// `nodes(ids:)` accepts at most 100 IDs per query.
const BATCH = 100
// GraphQL requests are heavier than REST pages; stay well under the secondary rate limit.
const CONCURRENCY = 4

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
      createdAt
      followers { totalCount }
      repositories(ownerAffiliations: OWNER) { totalCount }
    }
  }
}`

/**
 * Fetches public profiles for the given user node IDs, 100 per query.
 * The result is aligned with `ids`; deleted accounts are `null`.
 * `onProgress(done, total)` is called per batch.
 */
export async function fetchUsers(ids, token, onProgress = () => {}) {
  const batches = []
  for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH))
  const results = new Array(batches.length)

  let done = 0
  let next = 0
  onProgress(done, batches.length)

  async function worker() {
    while (next < batches.length) {
      const index = next++
      const data = await query(USERS, { ids: batches[index] }, token)
      results[index] = data.nodes
      onProgress(++done, batches.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker))
  return results.flat().map((u) => (u?.login ? {
    login: u.login,
    name: u.name,
    avatarUrl: u.avatarUrl,
    url: u.url,
    bio: u.bio,
    company: u.company,
    location: u.location,
    createdAt: u.createdAt,
    followers: u.followers.totalCount,
    repositories: u.repositories.totalCount,
  } : null))
}
