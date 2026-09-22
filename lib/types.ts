export type UseCase = 'reading' | 'ui' | 'display' | 'game' | 'code' | 'handwriting';

export interface FontEntry {
  family: string;
  category: 'SERIF' | 'SANS_SERIF' | 'DISPLAY' | 'HANDWRITING' | 'MONOSPACE';
  designer: string;
  license: string;
  subsets: string[];
  weights: number[];
  italic: boolean;
  variable: boolean;
  korean: boolean;
  sample: string;
  useCases: UseCase[];
  useCaseScores: Record<UseCase, number>;
  tone: number;
  readability: number;
  craft: number;
  note?: string;
}

export interface FontIndex {
  generatedAt: string;
  source: string;
  scope: string;
  count: number;
  fonts: FontEntry[];
}

export const USE_CASE_LABELS: Record<UseCase, string> = {
  reading: '본문·리딩',
  ui: 'UI·앱 기본',
  display: '타이틀·헤드라인',
  game: '게임·임팩트',
  code: '코드·숫자',
  handwriting: '손글씨·감성',
};

export const USE_CASE_ORDER: UseCase[] = [
  'ui', 'reading', 'display', 'game', 'handwriting', 'code',
];

export const CATEGORY_LABELS: Record<FontEntry['category'], string> = {
  SANS_SERIF: '고딕',
  SERIF: '명조',
  DISPLAY: '장식',
  HANDWRITING: '손글씨',
  MONOSPACE: '고정폭',
};
