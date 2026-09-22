'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import FontCard from './FontCard';
import { useFontLoader } from '@/lib/useFontLoader';
import {
  USE_CASE_LABELS, USE_CASE_ORDER, type FontEntry, type FontIndex, type UseCase,
} from '@/lib/types';

// 한글 서브셋 크기는 글자 수가 아니라 자모 구성이 정한다. 실측에서
// "다람쥐 헌 쳇바퀴에 타고파 SCORE 1250"(11자)은 폰트당 28KB 였는데
// 아래 문구는 9KB 다 — 복합 모음(쳇·퀴)이 자모 컴포넌트를 더 끌고 오기 때문이다.
// 첫 화면에 15종을 깔면 이 차이가 420KB 대 140KB 가 된다.
const DEFAULT_TEXT = '한글 폰트 고르기 Aa 123';
const COMPARE_LIMIT = 4;
const PAGE = 24;

const WEIGHT_CHOICES: (number | 'auto')[] = ['auto', 100, 300, 400, 500, 700, 900];

export default function Gallery({ index }: { index: FontIndex }) {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [size, setSize] = useState(30);
  const [weight, setWeight] = useState<number | 'auto'>('auto');
  const [useCase, setUseCase] = useState<UseCase | 'all'>('all');
  const [toneRange, setToneRange] = useState<[number, number]>([0, 100]);
  const [minWeights, setMinWeights] = useState(1);
  const [variableOnly, setVariableOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const [compare, setCompare] = useState<string[]>([]);
  const [dark, setDark] = useState(false);

  // 입력 중에 매 글자마다 CSS 를 받지 않도록 한 박자 늦춘다.
  const [debouncedText, setDebouncedText] = useState(text);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedText(text), 350);
    return () => clearTimeout(t);
  }, [text]);

  const { loaded, request } = useFontLoader(debouncedText || DEFAULT_TEXT);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  const filtered = useMemo(() => {
    const list = index.fonts.filter((f) => {
      if (useCase !== 'all' && !f.useCases.includes(useCase)) return false;
      if (f.tone < toneRange[0] || f.tone > toneRange[1]) return false;
      if (f.weights.length < minWeights) return false;
      if (variableOnly && !f.variable) return false;
      return true;
    });
    // 선택한 용도가 있으면 그 용도 적합도 순으로 보여준다.
    if (useCase !== 'all') {
      return [...list].sort((a, b) => b.useCaseScores[useCase] - a.useCaseScores[useCase]);
    }
    return list;
  }, [index.fonts, useCase, toneRange, minWeights, variableOnly]);

  useEffect(() => setVisibleCount(PAGE), [useCase, toneRange, minWeights, variableOnly]);

  const shown = filtered.slice(0, visibleCount);

  const toggleCompare = (family: string) =>
    setCompare((prev) =>
      prev.includes(family)
        ? prev.filter((f) => f !== family)
        : prev.length >= COMPARE_LIMIT
          ? prev
          : [...prev, family],
    );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: index.fonts.length };
    for (const f of index.fonts) for (const u of f.useCases) c[u] = (c[u] ?? 0) + 1;
    return c;
  }, [index.fonts]);

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-20 border-b backdrop-blur"
        style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
      >
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <h1 className="text-base font-bold">cnation font</h1>
              <span className="hidden text-xs sm:inline" style={{ color: 'var(--muted)' }}>
                구글 한글 폰트 {index.count}종
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: 'var(--border)' }}
            >
              {dark ? '라이트' : '다크'}
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={DEFAULT_TEXT}
              aria-label="미리보기 텍스트"
              className="min-w-0 flex-1 rounded border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                크기
                <input
                  type="range" min={14} max={72} value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="w-24" aria-label="미리보기 글자 크기"
                />
                <span className="w-7 tabular-nums">{size}</span>
              </label>
              <select
                value={String(weight)}
                onChange={(e) => setWeight(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                aria-label="굵기"
                className="rounded border px-2 py-1.5 text-xs"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
              >
                {WEIGHT_CHOICES.map((w) => (
                  <option key={String(w)} value={String(w)}>
                    {w === 'auto' ? '굵기 자동' : w}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-5">
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-32 space-y-5 text-sm">
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                용도
              </h2>
              <div className="space-y-0.5">
                {(['all', ...USE_CASE_ORDER] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUseCase(u as UseCase | 'all')}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm"
                    style={{
                      background: useCase === u ? 'var(--accent-soft)' : 'transparent',
                      color: useCase === u ? 'var(--accent)' : 'var(--text)',
                      fontWeight: useCase === u ? 600 : 400,
                    }}
                  >
                    <span>{u === 'all' ? '전체' : USE_CASE_LABELS[u as UseCase]}</span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                      {counts[u] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                톤
              </h2>
              <div className="px-1">
                <input
                  type="range" min={0} max={100} value={toneRange[1]}
                  onChange={(e) => setToneRange([0, Number(e.target.value)])}
                  className="w-full" aria-label="튐 정도 상한"
                />
                <div className="mt-1 flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
                  <span>평범</span>
                  <span className="tabular-nums">≤ {toneRange[1]}</span>
                  <span>튐</span>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                조건
              </h2>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={minWeights >= 3}
                  onChange={(e) => setMinWeights(e.target.checked ? 3 : 1)} />
                굵기 3종 이상
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={variableOnly}
                  onChange={(e) => setVariableOnly(e.target.checked)} />
                가변폰트만
              </label>
            </section>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
            <span>{filtered.length}종</span>
            <div className="flex gap-1.5 lg:hidden">
              {(['all', ...USE_CASE_ORDER] as const).map((u) => (
                <button
                  key={u} type="button" onClick={() => setUseCase(u as UseCase | 'all')}
                  className="whitespace-nowrap rounded px-2 py-1"
                  style={{
                    background: useCase === u ? 'var(--accent-soft)' : 'transparent',
                    color: useCase === u ? 'var(--accent)' : 'var(--muted)',
                  }}
                >
                  {u === 'all' ? '전체' : USE_CASE_LABELS[u as UseCase]}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>
              조건에 맞는 폰트가 없어. 톤 범위를 넓히거나 굵기 조건을 풀어봐.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((f: FontEntry) => (
                <FontCard
                  key={f.family}
                  font={f}
                  text={debouncedText || DEFAULT_TEXT}
                  size={size}
                  weight={weight}
                  loaded={loaded.has(f.family)}
                  onRequest={request}
                  inCompare={compare.includes(f.family)}
                  onToggleCompare={toggleCompare}
                />
              ))}
            </div>
          )}

          {visibleCount < filtered.length && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE)}
                className="rounded border px-4 py-2 text-sm"
                style={{ borderColor: 'var(--border)' }}
              >
                {filtered.length - visibleCount}종 더 보기
              </button>
            </div>
          )}
        </main>
      </div>

      {compare.length > 0 && (
        <div
          className="sticky bottom-0 z-20 border-t px-4 py-2.5 backdrop-blur"
          style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 92%, transparent)' }}
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 text-sm">
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              비교함 {compare.length}/{COMPARE_LIMIT}
            </span>
            {compare.map((f) => (
              <button
                key={f} type="button" onClick={() => toggleCompare(f)}
                className="rounded px-2 py-1 text-xs"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                {f} ✕
              </button>
            ))}
            <Link
              href={`/export?families=${compare.map(encodeURIComponent).join(',')}`}
              className="ml-auto rounded px-3 py-1.5 text-xs font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              최적화해서 내보내기 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
