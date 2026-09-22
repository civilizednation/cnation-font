'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useInView } from '@/lib/useFontLoader';
import { previewWeight } from '@/lib/googleFonts';
import { CATEGORY_LABELS, USE_CASE_LABELS, type FontEntry } from '@/lib/types';

interface Props {
  font: FontEntry;
  text: string;
  size: number;
  weight: number | 'auto';
  loaded: boolean;
  onRequest: (family: string, weights: number[]) => void;
  inCompare: boolean;
  onToggleCompare: (family: string) => void;
}

/** 선택한 굵기가 없는 폰트는 가장 가까운 굵기로 대신한다. */
function resolveWeight(font: FontEntry, weight: number | 'auto'): number {
  if (weight === 'auto') return previewWeight(font.weights);
  if (font.weights.includes(weight)) return weight;
  if (font.variable) {
    const min = Math.min(...font.weights);
    const max = Math.max(...font.weights);
    return Math.min(max, Math.max(min, weight));
  }
  return font.weights.reduce(
    (a, b) => (Math.abs(a - weight) <= Math.abs(b - weight) ? a : b),
    font.weights[0],
  );
}

export default function FontCard({
  font, text, size, weight, loaded, onRequest, inCompare, onToggleCompare,
}: Props) {
  // 텍스트가 바뀌면 관찰을 다시 걸어, 지금 화면에 있는 카드만 새로 받게 한다.
  const { ref, visible } = useInView<HTMLDivElement>(text);
  const actualWeight = resolveWeight(font, weight);
  const substituted = weight !== 'auto' && actualWeight !== weight;

  useEffect(() => {
    if (visible) onRequest(font.family, [actualWeight]);
  }, [visible, font.family, actualWeight, onRequest, text]);

  return (
    <div
      ref={ref}
      className="flex flex-col rounded-lg border p-4 transition-colors"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/font/${encodeURIComponent(font.family)}`}
            className="block truncate text-sm font-semibold hover:underline"
          >
            {font.family}
          </Link>
          <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
            {CATEGORY_LABELS[font.category]} · 굵기 {font.weights.length}종
            {font.variable && ' · 가변'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggleCompare(font.family)}
          aria-pressed={inCompare}
          title={inCompare ? '비교함에서 빼기' : '비교함에 담기'}
          className="shrink-0 rounded border px-2 py-1 text-xs"
          style={{
            borderColor: inCompare ? 'var(--accent)' : 'var(--border)',
            background: inCompare ? 'var(--accent-soft)' : 'transparent',
            color: inCompare ? 'var(--accent)' : 'var(--muted)',
          }}
        >
          {inCompare ? '담김' : '비교'}
        </button>
      </div>

      <div className="flex min-h-24 flex-1 items-center py-2">
        {loaded ? (
          <p
            className="w-full break-keep leading-snug"
            style={{
              fontFamily: `'${font.family}', sans-serif`,
              fontWeight: actualWeight,
              fontSize: `${size}px`,
            }}
          >
            {text || font.sample}
          </p>
        ) : (
          <div className="w-full space-y-2" aria-hidden>
            <div className="skeleton h-5 w-4/5" />
            <div className="skeleton h-5 w-3/5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        {font.useCases.map((u) => (
          <span
            key={u}
            className="rounded px-1.5 py-0.5"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            {USE_CASE_LABELS[u]}
          </span>
        ))}
        {substituted && (
          <span style={{ color: 'var(--muted)' }}>{actualWeight} 로 대체</span>
        )}
      </div>
    </div>
  );
}
