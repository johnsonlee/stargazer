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

/**
 * Fetches the `starred_at` timestamp of every stargazer.
 * `onProgress(done, total)` is called as pages arrive.
 */
export async function fetchStargazers(repo, token, onProgress = () => {}) {
  const url = (page) => `${API}/repos/${repo}/stargazers?per_page=${PER_PAGE}&page=${page}`
  const first = await request(url(1), token, STAR_JSON)
  const total = Math.min(lastPage(first.headers.get('Link')), MAX_PAGES)
  const pages = new Array(total)
  pages[0] = await first.json()

  let done = 1
  let next = 2
  onProgress(done, total)

  async function worker() {
    while (next <= total) {
      const page = next++
      pages[page - 1] = await (await request(url(page), token, STAR_JSON)).json()
      onProgress(++done, total)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total - 1) }, worker))
  return pages.flat().map((it) => it.starred_at)
}
