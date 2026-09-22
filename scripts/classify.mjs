// google/fonts 의 큐레이션 태그 점수(0~100)를 실제 제작에 쓰는 용도 분류로 환산한다.
//
// 설계에서 중요한 구분 하나:
//   /Quality/* (Spacing, Wordspace, Drawing) 는 "폰트가 잘 만들어졌는가"(craft)이지
//   "본문으로 읽기 좋은가"가 아니다. Black Han Sans 는 Spacing 70 / Wordspace 90 인
//   훌륭한 폰트지만 본문용은 아니다. 본문 적합성을 가르는 진짜 신호는
//   차분함(Calm·Competent·Business)과 자극(Loud·Rugged·Childlike·Futuristic…)의 대비다.
//
//   /Purpose/Easy Reading 은 전체 1,941개 중 15개에만 달려 있어(전부 라틴 폰트)
//   주 신호로 쓸 수 없고, 있으면 가산점으로만 쓴다.

export const USE_CASES = ['reading', 'ui', 'display', 'game', 'code', 'handwriting'];

export const USE_CASE_LABELS = {
  reading: '본문·리딩',
  ui: 'UI·앱 기본',
  display: '타이틀·헤드라인',
  game: '게임·임팩트',
  code: '코드·숫자',
  handwriting: '손글씨·감성',
};

const s = (tags, key) => tags?.[key] ?? 0;
const avg = (...xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const round = (v) => Math.round(clamp(v));

/** 차분함·신뢰감. 본문과 UI 의 핵심 신호. */
const calmness = (t) =>
  avg(s(t, 'Expressive/Calm'), s(t, 'Expressive/Competent'), s(t, 'Expressive/Business'));

/**
 * 자극의 세기. 하나만 강해도 본문에서 탈락하므로 평균이 아니라 최댓값을 쓴다.
 * (Jua 는 Loud 가 18로 낮지만 Childlike 85 라서 본문용이 아니다.)
 */
const energy = (t) =>
  Math.max(
    s(t, 'Expressive/Loud'),
    s(t, 'Expressive/Excited'),
    s(t, 'Expressive/Childlike'),
    s(t, 'Expressive/Playful'),
    s(t, 'Expressive/Fancy'),
    s(t, 'Expressive/Artistic'),
  );

/**
 * 질감·인상 태그. 시끄러움이 아니라 "느낌"이라서 약한 감점으로만 쓴다.
 * Sunflower 는 Calm 80 / Loud 1 인 차분한 산세리프인데 Futuristic 62, Rugged 60 을
 * 갖는다 — 이걸 energy 로 치면 본문에서 부당하게 탈락한다.
 */
const texture = (t) =>
  Math.max(
    s(t, 'Expressive/Rugged'),
    s(t, 'Expressive/Futuristic'),
    s(t, 'Expressive/Awkward'),
  );

/** 제작 품질. 용도를 가르지는 않지만 같은 용도 안에서 순위를 정한다. */
const craft = (t) =>
  avg(s(t, 'Quality/Spacing'), s(t, 'Quality/Wordspace'), s(t, 'Quality/Drawing'));

/** 정통 산세리프 골격인가. UI 적합성 신호. */
const sansForm = (t) =>
  Math.max(
    s(t, 'Sans/Neo Grotesque'),
    s(t, 'Sans/Grotesque'),
    s(t, 'Sans/Humanist'),
    s(t, 'Sans/Geometric'),
    s(t, 'Sans/Superellipse'),
  );

/** 정통 본문 세리프 골격인가. Fat Face·Didone 은 디스플레이용이라 제외한다. */
const serifForm = (t) =>
  Math.max(
    s(t, 'Serif/Transitional'),
    s(t, 'Serif/Old Style Garalde'),
    s(t, 'Serif/Humanist Venetian'),
    s(t, 'Serif/Modern'),
    s(t, 'Serif/Scotch'),
    s(t, 'Slab/Humanist'),
    s(t, 'Slab/Clarendon'),
  );

const scriptForm = (t) =>
  Math.max(
    s(t, 'Script/Handwritten'),
    s(t, 'Script/Informal'),
    s(t, 'Script/Formal'),
    s(t, 'Script/Upright Script'),
  );

const GAME_THEMES = [
  'Pixel', 'Techno', 'Blobby', 'Wacky', 'Distressed', 'Stencil',
  'Medieval', 'Inline', 'Shaded', 'Woodtype', 'Blackletter',
];
const gameTheme = (t) => Math.max(0, ...GAME_THEMES.map((n) => s(t, `Theme/${n}`)));

/** 평범(0) ↔ 튐(100). 필터 슬라이더가 쓰는 스칼라. */
export function toneScore(tags) {
  const loud = avg(
    s(tags, 'Expressive/Loud'),
    s(tags, 'Expressive/Excited'),
    s(tags, 'Expressive/Fancy'),
    s(tags, 'Expressive/Playful'),
    s(tags, 'Expressive/Artistic'),
    s(tags, 'Expressive/Childlike'),
  );
  const calm = avg(
    s(tags, 'Expressive/Calm'),
    s(tags, 'Expressive/Stiff'),
    s(tags, 'Expressive/Business'),
  );
  return round((loud - calm + 100) / 2);
}

export function useCaseScores(font, tags) {
  const cat = font.category;
  const nWeights = font.weights.length;
  const hasBold = font.weights.some((w) => w >= 700);
  const hasHeavy = font.weights.some((w) => w >= 800);

  const calm = calmness(tags);
  const loud = energy(tags);
  const grain = texture(tags);
  const quality = craft(tags);
  const script = scriptForm(tags);
  const theme = gameTheme(tags);
  const easyReading = s(tags, 'Purpose/Easy Reading');

  const isTextCategory = cat === 'SERIF' || cat === 'SANS_SERIF';

  const code =
    cat === 'MONOSPACE' || s(tags, 'Monospace/Monospace') >= 50 ? 100 : 0;

  // 손글씨는 카테고리가 확실하거나 Script 점수가 확실히 높을 때만.
  // (Jua 는 Script/Handwritten 60 이지만 둥근 산세리프지 손글씨가 아니다.)
  const handwriting =
    cat === 'HANDWRITING' ? 100 : script >= 70 ? round(script) : 0;

  const reading = !isTextCategory
    ? 0
    : round(
        30 +
          calm * 0.55 +
          quality * 0.25 +
          serifForm(tags) * 0.12 +
          (nWeights >= 2 ? 12 : 0) +
          easyReading * 0.3 -
          loud * 0.9 -
          grain * 0.3 -
          (theme >= 50 ? 40 : 0), // Blobby·Pixel 같은 테마 폰트는 본문이 아니다.
      );

  const ui = !isTextCategory
    ? 0
    : round(
        calm * 0.6 +
          (cat === 'SANS_SERIF' ? 20 : 0) +
          (nWeights >= 4 ? 20 : nWeights >= 2 ? 10 : 0) +
          (font.variable ? 8 : 0) +
          sansForm(tags) * 0.15 -
          loud * 0.8 -
          grain * 0.24 -
          (theme >= 50 ? 40 : 0),
      );

  const display = round(
    (hasHeavy ? 30 : hasBold ? 15 : 0) +
      (cat === 'DISPLAY' ? 30 : 0) +
      Math.max(s(tags, 'Expressive/Loud'), s(tags, 'Expressive/Excited')) * 0.5 +
      s(tags, 'Expressive/Rugged') * 0.25 +
      s(tags, 'Expressive/Futuristic') * 0.25 +
      quality * 0.1,
  );

  // Futuristic·Rugged 는 질감 태그라 별도 항으로 약하게 더한다. max 안에 넣으면
  // Sunflower(Loud 1, Futuristic 62) 같은 차분한 폰트가 게임용으로 올라온다.
  const game = round(
    Math.max(
      s(tags, 'Expressive/Loud'),
      s(tags, 'Expressive/Excited'),
      s(tags, 'Expressive/Playful'),
      s(tags, 'Expressive/Childlike'),
    ) *
      0.6 +
      s(tags, 'Expressive/Futuristic') * 0.35 +
      s(tags, 'Expressive/Rugged') * 0.2 +
      (theme >= 50 ? 40 : 0) +
      (cat === 'DISPLAY' ? 15 : 0),
  );

  return { reading, ui, display, game, code, handwriting };
}

export function classify(font, tags) {
  const scores = useCaseScores(font, tags);
  const THRESHOLD = 45;

  let useCases;
  if (scores.code >= 50) {
    useCases = ['code']; // 코드용은 전용 성격이 강해 단독으로 둔다.
  } else if (scores.handwriting >= 70) {
    useCases = ['handwriting'];
  } else {
    useCases = USE_CASES.filter((u) => scores[u] >= THRESHOLD);
    // 어디에도 못 들어간 폰트를 빈손으로 두지 않는다.
    if (useCases.length === 0) {
      useCases = [USE_CASES.reduce((a, b) => (scores[a] >= scores[b] ? a : b))];
    }
  }

  return {
    useCases,
    useCaseScores: scores,
    tone: toneScore(tags),
    readability: scores.reading,
    craft: round(craft(tags)),
  };
}
