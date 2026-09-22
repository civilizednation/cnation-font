// 폰트 메타데이터 수집 소스.
//
// 1차: fonts.google.com/metadata/fonts — 한 번의 요청으로 전체 패밀리 정보를 준다.
//      API 키가 필요 없고 굵기/서브셋/가변축/인기순위가 모두 들어있다.
// 2차: google/fonts 레포의 METADATA.pb 크롤 — 1차가 막혔을 때(사내 egress 정책 등)
//      raw.githubusercontent.com 만으로 같은 정보를 재구성한다.
//
// 분류 점수는 두 경로 모두 google/fonts 의 tags/all/families.csv 를 쓴다.

const RAW = 'https://raw.githubusercontent.com/google/fonts/main';
const TAGS_CSV = `${RAW}/tags/all/families.csv`;
const METADATA_ENDPOINT = 'https://fonts.google.com/metadata/fonts';
const LICENSE_DIRS = ['ofl', 'apache', 'ufl'];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function get(url, { as = 'text', retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return as === 'json' ? await res.json() : await res.text();
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 2 ** i * 500));
    }
  }
  throw lastErr;
}

/** "Noto Sans KR" -> "notosanskr" (google/fonts 디렉토리 규칙) */
export const slugify = (family) => family.toLowerCase().replace(/\s+/g, '');

/** CSV 한 줄을 파싱한다. 2열에 따옴표로 감싼 가변축 스펙이 들어있는 행이 있다. */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * tags/all/families.csv -> { "Noto Sans KR": { "Expressive/Calm": 80, ... } }
 *
 * 같은 태그가 여러 번 나오는 이유는 가변폰트를 굵기별로 채점하기 때문이다
 * (예: Noto Sans KR 의 Loud 는 wght@600 에서 45, wght@900 에서 80).
 * 폰트의 "성격"은 기본 인스턴스가 대표해야 하므로 한정자가 없는 행을 최우선으로,
 * 없으면 400 에 가장 가까운 굵기의 행을 고른다. 최댓값을 쓰면 가변폰트가 전부
 * 제일 굵은 인스턴스의 성격으로 왜곡된다.
 */
export async function fetchTagScores() {
  const csv = await get(TAGS_CSV);
  const best = {}; // family -> tag -> { score, distance }

  for (const line of csv.split('\n')) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const family = cols[0]?.trim();
    const qualifier = cols[1]?.trim() ?? '';
    const tag = cols[2]?.trim();
    const score = Number(cols[3]);
    if (!family || !tag?.startsWith('/') || !Number.isFinite(score)) continue;

    // 한정자 없음 = 거리 0, wght@N = |N - 400|, 그 외(wdth 조합 등) = 뒤로 민다.
    let distance;
    if (!qualifier) distance = 0;
    else {
      const w = qualifier.match(/wght@(\d+)/);
      distance = w ? Math.abs(Number(w[1]) - 400) + 1 : 10000;
    }

    const key = tag.slice(1); // 앞의 "/" 제거
    best[family] ??= {};
    const prev = best[family][key];
    if (!prev || distance < prev.distance) best[family][key] = { score, distance };
  }

  const out = {};
  for (const [family, tags] of Object.entries(best)) {
    out[family] = Object.fromEntries(
      Object.entries(tags).map(([k, v]) => [k, v.score]),
    );
  }
  return out;
}

/**
 * 가변폰트의 wght 축을 실제 선택 가능한 굵기 목록으로 편다.
 * METADATA.pb 의 fonts{} 블록은 가변폰트일 때 기본 인스턴스(보통 400) 하나만
 * 나열하므로, 이걸 안 하면 Noto Sans KR 의 굵기가 [400] 하나로 잡힌다.
 */
export function expandWeights(staticWeights, wghtAxis) {
  const out = new Set(staticWeights);
  if (wghtAxis) {
    const { min, max } = wghtAxis;
    for (let w = 100; w <= 900; w += 100) if (w >= min && w <= max) out.add(w);
    out.add(Math.round(min));
    out.add(Math.round(max));
  }
  return [...out].sort((a, b) => a - b);
}

/** METADATA.pb (protobuf text format) 에서 필요한 필드만 뽑는다. */
export function parseMetadataPb(text) {
  const top = {};
  const subsets = [];
  const weights = new Set();
  const styles = new Set();
  const axes = [];
  let block = null;
  let current = null;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const open = line.match(/^(\w+)\s*\{$/);
    if (open) {
      block = open[1];
      current = {};
      continue;
    }
    if (line === '}') {
      if (block === 'axes' && current?.tag) axes.push(current);
      block = null;
      current = null;
      continue;
    }

    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].replace(/\s*#.*$/, '').trim().replace(/^"|"$/g, '');

    if (block === 'fonts') {
      if (key === 'weight') weights.add(Number(value));
      if (key === 'style') styles.add(value);
    } else if (block === 'axes') {
      if (key === 'tag') current.tag = value;
      if (key === 'min_value') current.min = Number(value);
      if (key === 'max_value') current.max = Number(value);
    } else if (!block) {
      if (key === 'subsets') subsets.push(value);
      else top[key] ??= value;
    }
  }

  const wght = axes.find((a) => a.tag === 'wght');
  return {
    name: top.name,
    category: top.category ?? 'SANS_SERIF',
    designer: top.designer ?? '',
    license: top.license ?? 'OFL',
    subsets: subsets.filter((s) => s !== 'menu'),
    weights: expandWeights([...weights], wght),
    italic: styles.has('italic'),
    variable: axes.length > 0,
    axes: Object.fromEntries(axes.map((a) => [a.tag, { min: a.min, max: a.max }])),
    primaryScript: top.primary_script ?? null,
    dateAdded: top.date_added ?? null,
  };
}

/** 1차 소스. 막혀 있으면 null 을 돌려주고 호출부가 폴백하도록 한다. */
export async function fetchFromGoogleMetadata() {
  let json;
  try {
    const text = await get(METADATA_ENDPOINT, { retries: 2 });
    // 응답이 ")]}'" 로 시작하는 XSSI 프리픽스를 달고 올 때가 있다.
    json = JSON.parse(text.replace(/^\)\]\}'\s*/, ''));
  } catch (err) {
    console.warn(`  ! fonts.google.com 접근 실패 (${err.message}) — 레포 크롤로 폴백`);
    return null;
  }

  return (json.familyMetadataList ?? []).map((f) => {
    const staticWeights = Object.keys(f.fonts ?? {})
      .map((k) => Number(k.replace(/i$/, '')))
      .filter(Number.isFinite);
    // axes 는 [{tag,min,max}] 또는 {wght:{...}} 두 형태로 온다.
    const axesList = Array.isArray(f.axes)
      ? f.axes
      : Object.entries(f.axes ?? {}).map(([tag, v]) => ({ tag, ...v }));
    const wght = axesList.find((a) => a.tag === 'wght');
    const weights = expandWeights(
      staticWeights,
      wght && { min: wght.min ?? wght.min_value, max: wght.max ?? wght.max_value },
    );
    return {
      family: f.family,
      category: (f.category ?? 'Sans Serif').toUpperCase().replace(/[\s-]/g, '_'),
      designer: (f.designers ?? []).join(', '),
      license: 'OFL',
      subsets: (f.subsets ?? []).filter((s) => s !== 'menu'),
      weights,
      italic: Object.keys(f.fonts ?? {}).some((k) => k.endsWith('i')),
      variable: axesList.length > 0,
      axes: Object.fromEntries(axesList.map((a) => [a.tag, { min: a.min ?? a.min_value, max: a.max ?? a.max_value }])),
      primaryScript: f.primaryScript ?? null,
      dateAdded: f.dateAdded ?? null,
      popularity: f.popularity ?? null,
    };
  });
}

/** 2차 소스. 태그 CSV의 패밀리 목록을 기준으로 METADATA.pb 를 병렬 크롤한다. */
export async function fetchFromRepoCrawl(families, { concurrency = 16 } = {}) {
  const results = [];
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < families.length) {
      const family = families[cursor++];
      const slug = slugify(family);
      for (const dir of LICENSE_DIRS) {
        try {
          const pb = await get(`${RAW}/${dir}/${slug}/METADATA.pb`, { retries: 1 });
          const parsed = parseMetadataPb(pb);
          results.push({ family: parsed.name || family, ...parsed, name: undefined });
          break;
        } catch {
          // 다음 라이선스 디렉토리를 시도한다.
        }
      }
      if (++done % 200 === 0) console.log(`  … ${done}/${families.length}`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
