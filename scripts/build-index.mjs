#!/usr/bin/env node
// data/fonts.json 을 생성한다. GitHub Actions 에서 월 1회 돌리고 결과를 커밋한다.
//
//   node scripts/build-index.mjs            # 한글 지원 폰트만 (기본)
//   node scripts/build-index.mjs --all      # 전체 패밀리
//
// 런타임에는 이 JSON 만 쓴다. 앱에서 구글 API 를 호출하지 않으므로 키도, 쿼터도 없다.

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchTagScores,
  fetchFromGoogleMetadata,
  fetchFromRepoCrawl,
} from './sources.mjs';
import { classify } from './classify.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/fonts.json');
const KOREAN_ONLY = !process.argv.includes('--all');

// 카드에 기본으로 렌더할 문장. 한글 폰트는 한글 샘플을, 영문 폰트는 팬그램을 쓴다.
const SAMPLE_KO = '한글 폰트 고르기';
const SAMPLE_EN = 'Handgloves 123';

function normalizeCategory(raw) {
  const c = (raw ?? '').toUpperCase().replace(/[\s-]/g, '_');
  return ['SERIF', 'SANS_SERIF', 'DISPLAY', 'HANDWRITING', 'MONOSPACE'].includes(c)
    ? c
    : 'SANS_SERIF';
}

async function main() {
  console.log('1) 큐레이션 태그 점수 수집 …');
  const tagScores = await fetchTagScores();
  console.log(`   ${Object.keys(tagScores).length}개 패밀리의 태그 점수`);

  console.log('2) 폰트 메타데이터 수집 …');
  let fonts = await fetchFromGoogleMetadata();
  let source = 'fonts.google.com';

  if (!fonts) {
    source = 'google/fonts repo';
    fonts = await fetchFromRepoCrawl(Object.keys(tagScores));
  }
  console.log(`   ${fonts.length}개 패밀리 (소스: ${source})`);

  console.log('3) 분류 계산 …');
  const entries = fonts
    .filter((f) => f.family && f.weights?.length)
    .map((f) => {
      const font = { ...f, category: normalizeCategory(f.category) };
      const tags = tagScores[font.family] ?? {};
      const korean = font.subsets.includes('korean');
      return {
        family: font.family,
        category: font.category,
        designer: font.designer || '',
        license: font.license || 'OFL',
        subsets: font.subsets,
        weights: font.weights,
        italic: !!font.italic,
        variable: !!font.variable,
        korean,
        sample: korean ? SAMPLE_KO : SAMPLE_EN,
        ...classify(font, tags),
      };
    })
    .filter((f) => (KOREAN_ONLY ? f.korean : true));

  // 자동 분류가 틀린 폰트를 손으로 바로잡는다.
  const overrides = JSON.parse(await readFile(resolve(ROOT, 'data/overrides.json'), 'utf8'));
  let patched = 0;
  for (const entry of entries) {
    const o = overrides[entry.family];
    if (!o) continue;
    if (o.useCases) entry.useCases = o.useCases;
    if (o.addUseCases) entry.useCases = [...new Set([...entry.useCases, ...o.addUseCases])];
    if (o.removeUseCases) entry.useCases = entry.useCases.filter((u) => !o.removeUseCases.includes(u));
    if (o.note) entry.note = o.note;
    patched++;
  }
  if (patched) console.log(`   수동 보정 ${patched}개 적용`);

  // UI 적합도 + 가독성 순으로 정렬해서 기본 노출 순서를 잡는다.
  entries.sort(
    (a, b) =>
      b.useCaseScores.ui + b.readability - (a.useCaseScores.ui + a.readability),
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    source,
    scope: KOREAN_ONLY ? 'korean' : 'all',
    count: entries.length,
    fonts: entries,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload));
  const kb = (JSON.stringify(payload).length / 1024).toFixed(1);
  console.log(`4) data/fonts.json 작성 완료 — ${entries.length}개, ${kb} KB`);

  const byUse = {};
  for (const f of entries) for (const u of f.useCases) byUse[u] = (byUse[u] ?? 0) + 1;
  console.log('   용도별:', byUse);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
