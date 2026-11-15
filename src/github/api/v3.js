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

// The last page number from a `Link` header; `null` when there is no `last` link,
// i.e. the page just fetched is the last one.
function lastPage(link) {
  const match = link && link.match(/[?&]page=(\d+)>;\s*rel="last"/)
  return match ? Number(match[1]) : null
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
 * Fetches every page of a paginated endpoint from `firstPage` on, with bounded
 * concurrency. `url(page)` builds the URL for a 1-based page number.
 */
async function fetchAllPages(url, token, accept, onProgress = () => {}, maxPages = Infinity, firstPage = 1) {
  const first = await request(url(firstPage), token, accept)
  const last = Math.max(firstPage, Math.min(lastPage(first.headers.get('Link')) ?? firstPage, maxPages))
  const total = last - firstPage + 1
  const pages = new Array(total)
  pages[0] = await first.json()

  let done = 1
  let next = firstPage + 1
  onProgress(done, total)

  async function worker() {
    while (next <= last) {
      const page = next++
      pages[page - firstPage] = await (await request(url(page), token, accept)).json()
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
const stargazersUrl = (repo) => (page) => `${API}/repos/${repo}/stargazers?per_page=${PER_PAGE}&page=${page}`
const toStargazer = (it) => ({ starredAt: it.starred_at, id: it.user?.node_id })

export async function fetchStargazers(repo, token, onProgress) {
  const stargazers = await fetchAllPages(stargazersUrl(repo), token, STAR_JSON, onProgress, MAX_PAGES)
  return stargazers.map(toStargazer)
}

/**
 * Brings a stargazer list fetched earlier up to date. Stargazers are listed oldest first,
 * so only the page holding the last known one and any pages after it are read again,
 * usually a single request. Returns `null` when that page no longer starts where it
 * used to (someone unstarred earlier on), so the caller should fetch everything again.
 */
export async function fetchNewStargazers(repo, token, known) {
  const page = Math.min(Math.max(1, Math.ceil(known.length / PER_PAGE)), MAX_PAGES)
  const offset = (page - 1) * PER_PAGE
  const fresh = (await fetchAllPages(stargazersUrl(repo), token, STAR_JSON, undefined, MAX_PAGES, page)).map(toStargazer)
  if (known.length > offset && fresh[0]?.id !== known[offset].id) return null
  return known.slice(0, offset).concat(fresh)
}

/**
 * Fetches daily star counts as `[{ date: 'YYYY-MM-DD' (UTC), count }]`, days without
 * stars left out. Unlike the stargazer list, which GitHub has shown only to a
 * repository's admins and collaborators since June 2026, this works for any public
 * repository, but it never says who starred. Pages hold 30 weeks each.
 */
const historyUrl = (repo) => (page) => `${API}/repos/${repo}/stargazers/history?page=${page}`
const utcDate = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10)

function weeksToDays(weeks) {
  const days = []
  for (const { week, days: counts } of weeks) {
    counts.forEach((count, i) => {
      if (count) days.push({ date: utcDate(week + i * 86400), count })
    })
  }
  return days.sort((a, b) => (a.date < b.date ? -1 : 1))
}

export async function fetchStarHistory(repo, token, onProgress) {
  return weeksToDays(await fetchAllPages(historyUrl(repo), token, undefined, onProgress))
}

/**
 * Brings star history fetched earlier up to date by reading only the first page, which
 * holds the latest 30 weeks, and replacing those weeks in `known`.
 */
export async function fetchNewStarHistory(repo, token, known) {
  const weeks = await (await request(historyUrl(repo)(1), token)).json()
  if (!weeks.length) return known
  const since = utcDate(Math.min(...weeks.map((w) => w.week)))
  return known.filter((d) => d.date < since).concat(weeksToDays(weeks))
}
