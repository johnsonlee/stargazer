const API = 'https://api.github.com'
const STAR_JSON = 'application/vnd.github.star+json'
const PER_PAGE = 100
// GitHub refuses stargazer pages beyond 400 (40,000 stars at 100 per page).
const MAX_PAGES = 400
const CONCURRENCY = 6

export class GitHubError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function request(url, token, accept = 'application/vnd.github+json') {
  const headers = { Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' }
  if (token) headers.Authorization = `Bearer ${token}`
  const resp = await fetch(url, { headers })
  if (!resp.ok) {
    let message = resp.statusText
    try {
      message = (await resp.json()).message || message
    } catch {
      // non-JSON error body
    }
    throw new GitHubError(resp.status, message)
  }
  return resp
}

function lastPage(link) {
  const match = link && link.match(/[?&]page=(\d+)>;\s*rel="last"/)
  return match ? Number(match[1]) : 1
}

export async function fetchRateLimit(token) {
  return (await request(`${API}/rate_limit`, token)).json()
}

export async function fetchRepository(repo, token) {
  return (await request(`${API}/repos/${repo}`, token)).json()
}

export async function fetchUser(token) {
  return (await request(`${API}/user`, token)).json()
}

/**
 * Fetches every page of a paginated endpoint with bounded concurrency.
 * `url(page)` builds the URL for a 1-based page number.
 */
async function fetchAllPages(url, token, accept, onProgress = () => {}, maxPages = Infinity) {
  const first = await request(url(1), token, accept)
  const total = Math.min(lastPage(first.headers.get('Link')), maxPages)
  const pages = new Array(total)
  pages[0] = await first.json()

  let done = 1
  let next = 2
  onProgress(done, total)

  async function worker() {
    while (next <= total) {
      const page = next++
      pages[page - 1] = await (await request(url(page), token, accept)).json()
      onProgress(++done, total)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total - 1) }, worker))
  return pages.flat()
}

/** Every repository the token can see: owned, collaborator and organization member. */
export async function fetchUserRepos(token) {
  const url = (page) => `${API}/user/repos?per_page=${PER_PAGE}&page=${page}&sort=pushed&affiliation=owner,collaborator,organization_member`
  return fetchAllPages(url, token)
}

/**
 * Fetches every stargazer as `{ starredAt, id }`, where `id` is the user's GraphQL node ID.
 * `onProgress(done, total)` is called as pages arrive.
 */
export async function fetchStargazers(repo, token, onProgress) {
  const url = (page) => `${API}/repos/${repo}/stargazers?per_page=${PER_PAGE}&page=${page}`
  const stargazers = await fetchAllPages(url, token, STAR_JSON, onProgress, MAX_PAGES)
  return stargazers.map((it) => ({ starredAt: it.starred_at, id: it.user?.node_id }))
}

/**
 * Fetches daily star counts as `[{ date: 'YYYY-MM-DD' (UTC), count }]`, days without
 * stars left out. Unlike the stargazer list, which GitHub has shown only to a
 * repository's admins and collaborators since June 2026, this works for any public
 * repository, but it never says who starred. Pages hold 30 weeks each.
 */
export async function fetchStarHistory(repo, token, onProgress) {
  const url = (page) => `${API}/repos/${repo}/stargazers/history?page=${page}`
  const weeks = await fetchAllPages(url, token, undefined, onProgress)
  const days = []
  for (const { week, days: counts } of weeks) {
    counts.forEach((count, i) => {
      if (count) days.push({ date: new Date((week + i * 86400) * 1000).toISOString().slice(0, 10), count })
    })
  }
  return days
}
