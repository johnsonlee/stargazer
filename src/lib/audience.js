import { countryOf, isPlaceName } from './geo'

const YEAR = 365.2425 * 24 * 3600 * 1000
const MONTH = YEAR / 12

/**
 * Picks at most `size` items spread evenly across `list`, so the sample covers the
 * whole star history instead of only the earliest or latest stargazers.
 */
export function sampleEvenly(list, size) {
  if (list.length <= size) return list
  const step = list.length / size
  return Array.from({ length: size }, (_, i) => list[Math.floor(i * step)])
}

// Companies are typed freely ("@google", "Google LLC", "谷歌"); fold the common spellings.
const COMPANY_ALIASES = {
  'Alibaba': ['alibaba', 'alibaba group', 'alibaba-inc', 'alibaba inc', 'alibaba cloud', 'aliyun', 'antgroup', 'ant group', 'ant financial', '阿里巴巴', '阿里', '阿里云', '蚂蚁集团', '蚂蚁金服'],
  'Tencent': ['tencent', '腾讯', 'wechat', '微信'],
  'ByteDance': ['bytedance', 'byte dance', '字节跳动', '字节', 'tiktok', '抖音'],
  'Baidu': ['baidu', '百度'],
  'Meituan': ['meituan', '美团'],
  'DiDi': ['didi', 'didi chuxing', 'didiglobal', '滴滴', '滴滴出行'],
  'JD.com': ['jd', 'jd.com', '京东'],
  'Huawei': ['huawei', '华为'],
  'Xiaomi': ['xiaomi', '小米'],
  'NetEase': ['netease', '网易'],
  'Kuaishou': ['kuaishou', '快手'],
  'PDD': ['pinduoduo', 'pdd', '拼多多'],
  'Google': ['google', 'google llc', 'google inc', '谷歌'],
  'Microsoft': ['microsoft', 'microsoft corporation', '微软'],
  'Meta': ['meta', 'facebook', 'meta platforms'],
  'Amazon': ['amazon', 'aws', 'amazon web services', '亚马逊'],
  'Apple': ['apple', '苹果'],
}
// alias -> display name; display names keep their capitals, so they never clash with folded keys
const COMPANY_LOOKUP = new Map()
for (const [name, aliases] of Object.entries(COMPANY_ALIASES)) for (const a of aliases) COMPANY_LOOKUP.set(a, name)

const COMPANY_SUFFIX = /[\s,]+(inc|inc\.|llc|ltd|ltd\.|limited|co\.?,? ?ltd\.?|corp|corp\.|corporation|gmbh|group|technology|technologies)$/

// "@foo @bar" or "foo / bar" -> the first one listed
const firstCompany = (company) => company.trim().replace(/^https?:\/\/(www\.)?/i, '').split(/\s*[,/|&]\s*|\s+(?=@)/)[0].replace(/^@+/, '')

function companyKey(company) {
  let key = firstCompany(company).toLowerCase().replace(/\.(com|cn|io|net|org)\/?$/, '').trim()
  key = COMPANY_LOOKUP.get(key) || key.replace(COMPANY_SUFFIX, '').trim()
  return COMPANY_LOOKUP.get(key) || key
}

const IGNORED_COMPANIES = new Set(['none', 'n/a', 'na', 'no', 'null', '-', 'self', 'self-employed', 'freelance', 'freelancer', 'student', 'home', 'personal', 'private', 'independent', '无', '个人', '学生'])

/** Counts `key(item)` over items, returning `[{ label, count }]` sorted by count. */
function rank(items, key, label = (k) => k) {
  const counts = new Map()
  const labels = new Map()
  for (const item of items) {
    const k = key(item)
    if (k == null) continue
    counts.set(k, (counts.get(k) || 0) + 1)
    if (!labels.has(k)) labels.set(k, label(k, item))
  }
  return [...counts].map(([k, count]) => ({ label: labels.get(k), count })).sort((a, b) => b.count - a.count)
}

/** Splits values into labeled buckets by ascending upper bounds (the last bound is open). */
function histogram(values, buckets) {
  const counts = buckets.map((b) => ({ label: b.label, count: 0 }))
  for (const v of values) counts[buckets.findIndex((b) => v < b.below)].count++
  return counts
}

const FOLLOWER_BUCKETS = [
  { label: 'None', below: 1 },
  { label: '1–9', below: 10 },
  { label: '10–99', below: 100 },
  { label: '100–999', below: 1000 },
  { label: '1k+', below: Infinity },
]

const AGE_BUCKETS = [
  { label: 'Under a month', below: MONTH },
  { label: '1–12 months', below: YEAR },
  { label: '1–3 years', below: 3 * YEAR },
  { label: '3–5 years', below: 5 * YEAR },
  { label: '5–10 years', below: 10 * YEAR },
  { label: '10+ years', below: Infinity },
]

function median(values) {
  if (!values.length) return 0
  const sorted = values.toSorted((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Summarizes stargazer profiles. `users` is `[{ starredAt, profile }]`; profiles of
 * deleted accounts are `null` and left out.
 */
export function analyzeAudience(users) {
  const people = users.filter((u) => u.profile)
  const profiles = people.map((u) => u.profile)

  const located = profiles.filter((p) => p.location?.trim())
  const countries = rank(located, (p) => countryOf(p.location))
  const recognized = countries.reduce((sum, c) => sum + c.count, 0)

  const employed = profiles.filter((p) => {
    const company = p.company && firstCompany(p.company)
    return company && !IGNORED_COMPANIES.has(company.toLowerCase()) && !isPlaceName(company)
  })
  const companies = rank(employed, (p) => companyKey(p.company) || null, (k, p) => (COMPANY_ALIASES[k] ? k : firstCompany(p.company)))

  const followers = profiles.map((p) => p.followers)
  // How old the account was when it starred the repository; new accounts are a fake-star signal.
  const ages = people.map((u) => Math.max(0, Date.parse(u.starredAt) - Date.parse(u.profile.createdAt)))
  const empty = profiles.filter((p) => p.followers === 0 && p.repositories === 0 && !p.bio?.trim()).length

  return {
    size: profiles.length,
    deleted: users.length - profiles.length,
    medianFollowers: median(followers),
    medianAgeYears: median(ages) / YEAR,
    newAccounts: ages.filter((a) => a < MONTH).length,
    located: located.length,
    recognized,
    countries,
    employed: employed.length,
    companies,
    followers: histogram(followers, FOLLOWER_BUCKETS),
    ages: histogram(ages, AGE_BUCKETS),
    empty,
    notable: profiles.toSorted((a, b) => b.followers - a.followers).slice(0, 12),
  }
}
