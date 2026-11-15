// Maps GitHub's free-text `location` to a country or region. Profiles mix languages,
// abbreviations and city-only entries ("杭州", "Shenzhen , China", "SF, CA"), so each
// place lists its English and native names, common abbreviations, and the provinces,
// states and cities that show up most often on GitHub.

const PLACES = {
  'China': [
    'china', 'prc', 'p.r.china', 'p.r. china', 'mainland china', '中国', '中國', '中华人民共和国',
    'beijing', 'peking', 'shanghai', 'shenzhen', 'hangzhou', 'guangzhou', 'canton', 'chengdu', 'wuhan',
    'nanjing', "xi'an", 'xian', 'suzhou', 'tianjin', 'chongqing', 'xiamen', 'changsha', 'hefei',
    'zhengzhou', 'jinan', 'qingdao', 'dalian', 'shenyang', 'harbin', 'fuzhou', 'kunming', 'ningbo',
    'dongguan', 'foshan', 'zhuhai', 'nanchang', 'taiyuan', 'shijiazhuang', 'changchun', 'guiyang',
    'nanning', 'lanzhou', 'wuxi', 'hohhot', 'urumqi', 'haikou', 'sanya', 'zhongshan', 'wenzhou',
    'guangdong', 'zhejiang', 'jiangsu', 'sichuan', 'hubei', 'hunan', 'fujian', 'shandong', 'henan',
    'hebei', 'anhui', 'jiangxi', 'liaoning', 'jilin', 'heilongjiang', 'shaanxi', 'shanxi', 'yunnan',
    'guizhou', 'guangxi', 'hainan', 'gansu', 'inner mongolia', 'xinjiang', 'tibet', 'ningxia', 'qinghai',
    '北京', '上海', '深圳', '杭州', '广州', '廣州', '成都', '武汉', '南京', '西安', '苏州', '天津', '重庆',
    'amoy', '厦门', '长沙', '合肥', '郑州', '济南', '青岛', '大连', '沈阳', '哈尔滨', '福州', '昆明', '宁波',
    '东莞', '佛山', '珠海', '南昌', '太原', '石家庄', '长春', '贵阳', '南宁', '兰州', '无锡', '温州',
    '广东', '浙江', '江苏', '四川', '湖北', '湖南', '福建', '山东', '河南', '河北', '安徽', '江西',
    '辽宁', '吉林', '黑龙江', '陕西', '山西', '云南', '贵州', '广西', '海南', '甘肃', '内蒙古', '新疆',
  ],
  'Hong Kong': ['hong kong', 'hongkong', 'hk', 'hksar', '香港', 'kowloon'],
  'Taiwan': ['taiwan', 'taipei', 'new taipei', 'taichung', 'kaohsiung', 'tainan', 'hsinchu', '台湾', '台灣', '臺灣', '台北', '臺北', '新竹'],
  'Macau': ['macau', 'macao', '澳门', '澳門'],
  'Japan': ['japan', '日本', 'tokyo', '東京', 'osaka', '大阪', 'kyoto', 'yokohama', 'nagoya', 'fukuoka', 'sapporo', 'kobe'],
  'South Korea': ['korea', 'south korea', 'republic of korea', '대한민국', '한국', 'seoul', '서울', 'busan', 'incheon', 'daejeon', 'pangyo', 'seongnam'],
  'Singapore': ['singapore', '新加坡'],
  'India': ['india', 'bharat', 'bangalore', 'bengaluru', 'mumbai', 'bombay', 'delhi', 'new delhi', 'hyderabad', 'chennai', 'pune', 'kolkata', 'noida', 'gurgaon', 'gurugram', 'ahmedabad', 'jaipur', 'kerala', 'kochi', 'karnataka', 'maharashtra', 'tamil nadu', 'telangana', 'uttar pradesh', 'gujarat', 'west bengal'],
  'Indonesia': ['indonesia', 'jakarta', 'bandung', 'surabaya', 'yogyakarta', 'jogja', 'bali', 'jawa', 'sumatra', 'malang', 'semarang'],
  'Vietnam': ['vietnam', 'viet nam', 'hanoi', 'ha noi', 'ho chi minh', 'saigon', 'da nang'],
  'Thailand': ['thailand', 'bangkok', 'chiang mai'],
  'Malaysia': ['malaysia', 'kuala lumpur', 'penang', 'selangor', 'johor'],
  'Philippines': ['philippines', 'manila', 'cebu', 'quezon city', 'makati'],
  'Pakistan': ['pakistan', 'karachi', 'lahore', 'islamabad', 'rawalpindi'],
  'Bangladesh': ['bangladesh', 'dhaka', 'chittagong'],
  'Sri Lanka': ['sri lanka', 'colombo'],
  'Nepal': ['nepal', 'kathmandu'],
  'Iran': ['iran', 'tehran', 'isfahan', 'shiraz', 'mashhad', 'tabriz'],
  'Israel': ['israel', 'tel aviv', 'tel-aviv', 'jerusalem', 'haifa'],
  'Turkey': ['turkey', 'türkiye', 'turkiye', 'istanbul', 'ankara', 'izmir'],
  'United Arab Emirates': ['united arab emirates', 'uae', 'dubai', 'abu dhabi'],
  'Saudi Arabia': ['saudi arabia', 'ksa', 'riyadh', 'jeddah'],
  'Egypt': ['egypt', 'cairo', 'alexandria', 'giza'],
  'Nigeria': ['nigeria', 'lagos', 'abuja'],
  'Kenya': ['kenya', 'nairobi'],
  'South Africa': ['south africa', 'cape town', 'johannesburg', 'pretoria', 'durban'],
  'Morocco': ['morocco', 'casablanca', 'rabat', 'marrakech'],
  'Algeria': ['algeria', 'algiers'],
  'Tunisia': ['tunisia', 'tunis'],
  'United States': [
    'united states', 'united states of america', 'usa', 'us', 'u.s.', 'u.s.a.', '美国', '美國',
    'san francisco', 'sf', 'bay area', 'sf bay area', 'silicon valley', 'new york', 'nyc', 'new york city', 'brooklyn',
    'los angeles', 'seattle', 'boston', 'chicago', 'austin', 'san jose', 'mountain view', 'palo alto',
    'sunnyvale', 'cupertino', 'menlo park', 'redmond', 'bellevue', 'oakland', 'berkeley', 'san diego',
    'portland', 'denver', 'atlanta', 'miami', 'dallas', 'houston', 'philadelphia', 'pittsburgh',
    'washington dc', 'washington, d.c.', 'washington d.c.', 'minneapolis', 'salt lake city', 'phoenix',
    'raleigh', 'nashville', 'detroit', 'ann arbor', 'cambridge, ma', 'madison', 'columbus',
    'california', 'texas', 'florida', 'washington', 'massachusetts', 'illinois', 'colorado', 'oregon',
    'georgia', 'virginia', 'north carolina', 'pennsylvania', 'ohio', 'michigan', 'new jersey', 'arizona',
    'utah', 'minnesota', 'wisconsin', 'maryland', 'tennessee', 'missouri', 'indiana', 'connecticut',
  ],
  'Canada': ['canada', 'toronto', 'vancouver', 'montreal', 'montréal', 'ottawa', 'calgary', 'edmonton', 'waterloo', 'quebec', 'québec', 'ontario', 'british columbia', 'alberta', '加拿大'],
  'Mexico': ['mexico', 'méxico', 'mexico city', 'cdmx', 'guadalajara', 'monterrey'],
  'Brazil': ['brazil', 'brasil', 'são paulo', 'sao paulo', 'rio de janeiro', 'belo horizonte', 'curitiba', 'porto alegre', 'brasília', 'brasilia', 'recife', 'florianópolis', 'florianopolis', 'fortaleza', 'salvador'],
  'Argentina': ['argentina', 'buenos aires', 'córdoba', 'cordoba', 'rosario'],
  'Chile': ['chile', 'santiago'],
  'Colombia': ['colombia', 'bogotá', 'bogota', 'medellín', 'medellin', 'cali'],
  'Peru': ['peru', 'perú', 'lima'],
  'United Kingdom': ['united kingdom', 'uk', 'u.k.', 'great britain', 'britain', 'england', 'scotland', 'wales', 'northern ireland', 'london', 'manchester', 'edinburgh', 'oxford', 'bristol', 'birmingham', 'glasgow', 'leeds', '英国', '英國'],
  'Ireland': ['ireland', 'dublin', 'cork'],
  'Germany': ['germany', 'deutschland', '德国', 'berlin', 'mannheim', 'heidelberg', 'bonn', 'aachen', 'hannover', 'hanover', 'munich', 'münchen', 'muenchen', 'hamburg', 'frankfurt', 'cologne', 'köln', 'stuttgart', 'düsseldorf', 'dusseldorf', 'leipzig', 'dresden', 'karlsruhe', 'bavaria', 'bayern', 'nuremberg', 'nürnberg'],
  'France': ['france', '法国', 'paris', 'lyon', 'marseille', 'toulouse', 'bordeaux', 'lille', 'nantes', 'grenoble', 'montpellier'],
  'Netherlands': ['netherlands', 'the netherlands', 'holland', 'nederland', 'amsterdam', 'rotterdam', 'utrecht', 'eindhoven', 'the hague', 'delft'],
  'Belgium': ['belgium', 'brussels', 'antwerp', 'ghent'],
  'Switzerland': ['switzerland', 'schweiz', 'suisse', 'zurich', 'zürich', 'geneva', 'genève', 'lausanne', 'basel', 'bern'],
  'Austria': ['austria', 'österreich', 'vienna', 'wien', 'graz'],
  'Spain': ['spain', 'españa', 'espana', 'madrid', 'barcelona', 'valencia', 'seville', 'sevilla', 'málaga', 'malaga', 'bilbao'],
  'Portugal': ['portugal', 'lisbon', 'lisboa', 'porto'],
  'Italy': ['italy', 'italia', 'rome', 'roma', 'milan', 'milano', 'turin', 'torino', 'naples', 'napoli', 'bologna', 'florence', 'firenze'],
  'Sweden': ['sweden', 'sverige', 'stockholm', 'gothenburg', 'göteborg', 'malmö', 'malmo'],
  'Norway': ['norway', 'norge', 'oslo', 'bergen', 'trondheim'],
  'Denmark': ['denmark', 'danmark', 'copenhagen', 'københavn', 'aarhus'],
  'Finland': ['finland', 'suomi', 'helsinki', 'espoo', 'tampere'],
  'Poland': ['poland', 'polska', 'warsaw', 'warszawa', 'kraków', 'krakow', 'wrocław', 'wroclaw', 'gdańsk', 'gdansk', 'poznań', 'poznan'],
  'Czechia': ['czechia', 'czech republic', 'prague', 'praha', 'brno'],
  'Hungary': ['hungary', 'budapest'],
  'Romania': ['romania', 'bucharest', 'cluj-napoca', 'cluj'],
  'Bulgaria': ['bulgaria', 'sofia'],
  'Greece': ['greece', 'athens', 'thessaloniki'],
  'Ukraine': ['ukraine', 'україна', 'kyiv', 'kiev', 'київ', 'kharkiv', 'lviv', 'odesa', 'odessa', 'dnipro'],
  'Russia': ['russia', 'russian federation', 'россия', 'moscow', 'москва', 'saint petersburg', 'st. petersburg', 'st petersburg', 'санкт-петербург', 'novosibirsk', 'yekaterinburg', 'kazan', 'tomsk', '俄罗斯'],
  'Belarus': ['belarus', 'minsk'],
  'Serbia': ['serbia', 'belgrade', 'novi sad'],
  'Croatia': ['croatia', 'zagreb'],
  'Lithuania': ['lithuania', 'vilnius'],
  'Estonia': ['estonia', 'tallinn'],
  'Kazakhstan': ['kazakhstan', 'almaty', 'astana'],
  'Uzbekistan': ['uzbekistan', 'tashkent'],
  'Ethiopia': ['ethiopia', 'addis ababa'],
  'Ghana': ['ghana', 'accra'],
  'Cameroon': ['cameroon', 'yaoundé', 'douala', 'buea'],
  'Uruguay': ['uruguay', 'montevideo'],
  'Venezuela': ['venezuela', 'caracas'],
  'Ecuador': ['ecuador', 'quito'],
  'Australia': ['australia', '澳大利亚', '澳洲', 'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'canberra'],
  'New Zealand': ['new zealand', 'auckland', 'wellington', 'christchurch'],
}

// Two-letter codes are only trusted as the last part of a multi-part location
// ("Cambridge, MA") and only when no part names a known place, so "Bangalore, IN" stays India.
const US_STATES = 'al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc'.split(' ')
const CODES = {
  'United States': US_STATES,
  'Canada': ['on', 'bc', 'ab', 'qc'],
  'China': ['cn'],
  'Japan': ['jp'],
  'South Korea': ['kr'],
  'Germany': ['ger'],
  'Brazil': ['br'],
}
// Chinese city abbreviations that are common on their own.
const SHORTHANDS = { cn: 'China', bj: 'China', sh: 'China', sz: 'China', hz: 'China', gz: 'China', cq: 'China', cd: 'China' }

const NAMES = new Map()
// pinyin and run-together names are often spaced differently ("Shang Hai", "NewYork")
const COMPACT = new Map()
// non-Latin names are matched anywhere, since Chinese and Japanese text isn't space-separated
const NATIVE = []
for (const [country, aliases] of Object.entries(PLACES)) {
  for (const alias of aliases) {
    NAMES.set(alias, country)
    if (alias.length >= 5) COMPACT.set(alias.replace(/[\s'-]/g, ''), country)
    if (/[^\p{Script=Latin}\p{Script=Common}]/u.test(alias)) NATIVE.push([alias, country])
  }
}
// longest first, so a longer name is never shadowed by a shorter one inside it
NATIVE.sort((a, b) => b[0].length - a[0].length)

const TRAILING_CODES = new Map()
for (const [country, codes] of Object.entries(CODES)) for (const code of codes) TRAILING_CODES.set(code, country)

function lookupPhrase(part) {
  const direct = NAMES.get(part) || COMPACT.get(part.replace(/[\s'-]/g, ''))
  if (direct) return direct
  // try word n-grams, longest first, so "new york" beats "york"
  const words = part.split(/\s+/).map((w) => w.replace(/\.+$/, '')).filter(Boolean)
  for (let n = Math.min(words.length, 4); n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const phrase = words.slice(i, i + n).join(' ')
      if (n === 1 && phrase.length < 3 && !['us', 'uk', 'hk', 'sf'].includes(phrase)) continue
      const hit = NAMES.get(phrase)
      if (hit) return hit
    }
  }
  return null
}

/** Whether `text` is exactly a known place name, e.g. "China" or "shanghai" typed as a company. */
export function isPlaceName(text) {
  const key = text.toLowerCase().normalize('NFC').trim()
  return NAMES.has(key) || COMPACT.has(key.replace(/[\s'-]/g, ''))
}

/** The country or region a free-text location refers to, or `null` when it can't tell. */
export function countryOf(location) {
  if (!location) return null
  const text = location.toLowerCase().normalize('NFC').trim()
  if (!text) return null

  if (NAMES.has(text)) return NAMES.get(text)
  if (SHORTHANDS[text]) return SHORTHANDS[text]

  // Countries usually come last ("Hangzhou, Zhejiang, China"), so scan parts from the end.
  const parts = text.split(/\s*[,;/|·•()（）、，]+\s*|\s+-\s+/).map((p) => p.replace(/\.$/, '').trim()).filter(Boolean)
  for (const part of parts.toReversed()) {
    // then "China.GuangZhou", "CHINA-BeiJing" and "SC_CD", joined without spaces
    const pieces = [part, ...part.split(/(?<=\p{L})[._-](?=\p{L})/u).toReversed()]
    for (const piece of pieces) {
      const hit = lookupPhrase(piece) || SHORTHANDS[piece]
      if (hit) return hit
    }
  }
  if (parts.length > 1) {
    const code = TRAILING_CODES.get(parts.at(-1)) || SHORTHANDS[parts.at(-1)]
    if (code) return code
  }

  for (const [alias, country] of NATIVE) if (text.includes(alias)) return country
  return null
}
