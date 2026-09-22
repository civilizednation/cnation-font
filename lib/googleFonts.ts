// Google Fonts CSS API v2 래퍼.
//
// 핵심은 text= 파라미터다. 미리보기에 쓸 글자만 서버에서 잘라 내려주기 때문에
// 한글 폰트 한 벌이 1.8MB -> 28KB 로 줄어든다. 이게 없으면 갤러리를 만들 수 없다.

const CSS_ENDPOINT = 'https://fonts.googleapis.com/css2';

/** 한 번의 CSS 요청에 묶을 패밀리 수. URL 길이와 응답 지연의 절충점. */
export const BATCH_SIZE = 12;

export interface FontRequest {
  family: string;
  weights: number[];
}

/**
 * text= 값을 정규화한다. 글자 순서와 중복은 렌더 결과에 영향이 없지만 URL 이
 * 달라지면 구글 CDN 과 브라우저 캐시가 모두 미스가 난다. 정렬·중복제거해서
 * 같은 글자 집합이 항상 같은 URL 이 되게 한다.
 */
export function normalizeText(text: string): string {
  return [...new Set([...text])].filter((c) => c.trim() !== '').sort().join('');
}

export function buildCssUrl(requests: FontRequest[], text: string): string {
  const families = requests
    .map((r) => {
      const name = r.family.replace(/ /g, '+');
      const weights = [...new Set(r.weights)].sort((a, b) => a - b);
      // 굵기가 400 하나뿐이면 지정을 생략해 URL 을 짧게 유지한다.
      return weights.length === 1 && weights[0] === 400
        ? `family=${name}`
        : `family=${name}:wght@${weights.join(';')}`;
    })
    .join('&');

  const normalized = normalizeText(text);
  const textParam = normalized ? `&text=${encodeURIComponent(normalized)}` : '';
  return `${CSS_ENDPOINT}?${families}${textParam}&display=swap`;
}

/** 이미 주입한 URL. 같은 스타일시트를 두 번 넣지 않는다. */
const injected = new Set<string>();

/**
 * <link rel="stylesheet"> 를 head 에 넣고 로드를 기다린다.
 * FontFace API 로 직접 만들지 않는 이유는, css2 응답이 가변폰트와 정적 폰트를
 * 알아서 구분해 unicode-range 까지 붙여주기 때문이다. 그걸 손으로 재현할 이유가 없다.
 */
export function loadCss(url: string): Promise<void> {
  if (injected.has(url)) return Promise.resolve();
  injected.add(url);

  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.crossOrigin = 'anonymous';
    // 실패해도 갤러리는 폴백 폰트로 계속 그려져야 한다.
    link.onload = () => resolve();
    link.onerror = () => {
      injected.delete(url);
      resolve();
    };
    document.head.appendChild(link);
  });
}

/** 카드에 쓸 대표 굵기. 400 이 있으면 400, 없으면 그에 가장 가까운 굵기. */
export function previewWeight(weights: number[]): number {
  if (weights.includes(400)) return 400;
  return weights.reduce((a, b) => (Math.abs(a - 400) <= Math.abs(b - 400) ? a : b), weights[0] ?? 400);
}

/** CSS 에서 실제 woff2 URL 을 뽑는다. 내보내기 기능이 쓴다. */
export function extractFontUrls(css: string): { weight: number; url: string }[] {
  const out: { weight: number; url: string }[] = [];
  for (const block of css.split('@font-face')) {
    const weight = Number(block.match(/font-weight:\s*(\d+)/)?.[1]);
    const url = block.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/)?.[1];
    if (Number.isFinite(weight) && url) out.push({ weight, url });
  }
  return out;
}

export { CSS_ENDPOINT };
