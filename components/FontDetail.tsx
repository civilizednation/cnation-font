'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { buildCssUrl, loadCss } from '@/lib/googleFonts';
import {
  CATEGORY_LABELS, USE_CASE_LABELS, USE_CASE_ORDER, type FontEntry,
} from '@/lib/types';

const MOCKUP_TEXT = {
  title: '레벨 선택',
  body: '스테이지를 하나 고르면 바로 시작해. 남은 목숨은 세 개고, 제한 시간은 90초야.',
  button: '계속하기',
  hud: 'SCORE 1250',
  label: '최고 기록',
};

/** 굵기별 줄에 쓰는 표본. 아래 MOCKUP_CHARS 에 반드시 포함되어야 한다. */
const WEIGHT_SAMPLE = '한글 폰트 고르기 Ag 0123';

/**
 * 이 화면이 그리는 모든 글자를 한 군데 모은다. text= 요청이 이 집합으로 한 번만
 * 나가므로, 여기 빠진 글자는 폴백 폰트로 렌더되어 비교가 어긋난다.
 */
const MOCKUP_CHARS =
  Object.values(MOCKUP_TEXT).join('') +
  WEIGHT_SAMPLE +
  '가나다라마바사아자차카타파하 ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 ?!.,%-';

export default function FontDetail({ font }: { font: FontEntry }) {
  const [custom, setCustom] = useState('');
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);

  const text = custom || MOCKUP_CHARS;

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  useEffect(() => {
    setReady(false);
    const t = setTimeout(() => {
      loadCss(buildCssUrl([{ family: font.family, weights: font.weights }], text))
        .then(() => setReady(true));
    }, custom ? 350 : 0);
    return () => clearTimeout(t);
  }, [font.family, font.weights, text, custom]);

  const ff = `'${font.family}', sans-serif`;
  const bold = useMemo(
    () => font.weights.filter((w) => w >= 700)[0] ?? Math.max(...font.weights),
    [font.weights],
  );
  const regular = font.weights.includes(400) ? 400 : font.weights[0];

  return (
    <div className="min-h-screen">
      <header className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-sm hover:underline" style={{ color: 'var(--muted)' }}>
            ← 갤러리
          </Link>
          <div className="flex gap-2">
            <button
              type="button" onClick={() => setDark((d) => !d)}
              className="rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--border)' }}
            >
              {dark ? '라이트' : '다크'}
            </button>
            <Link
              href={`/export?families=${encodeURIComponent(font.family)}`}
              className="rounded px-3 py-1 text-xs font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              내보내기
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        <section>
          <h1 className="text-2xl font-bold">{font.family}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {CATEGORY_LABELS[font.category]} · 굵기 {font.weights.join(', ')}
            {font.variable && ' · 가변폰트'} · {font.license}
            {font.designer && ` · ${font.designer}`}
          </p>
          {font.note && (
            <p className="mt-2 rounded px-3 py-2 text-sm"
               style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              {font.note}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: 'var(--muted)' }}>
            {USE_CASE_ORDER.map((u) => (
              <span key={u} className="tabular-nums">
                {USE_CASE_LABELS[u]} {font.useCaseScores[u]}
              </span>
            ))}
            <span className="tabular-nums">톤 {font.tone}</span>
          </div>
        </section>

        <section>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="네 앱에 실제로 쓸 문구를 넣어봐"
            aria-label="미리보기 텍스트"
            className="w-full rounded border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
          />
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            굵기별
          </h2>
          <div className="space-y-2">
            {font.weights.map((w) => (
              <div key={w} className="flex items-baseline gap-3 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                <span className="w-9 shrink-0 text-xs tabular-nums" style={{ color: 'var(--muted)' }}>{w}</span>
                {ready ? (
                  <p className="break-keep text-xl" style={{ fontFamily: ff, fontWeight: w }}>
                    {custom || WEIGHT_SAMPLE}
                  </p>
                ) : (
                  <div className="skeleton h-6 w-2/3" />
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            실제 UI 에 넣어보면
          </h2>
          <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
            카드에서 예뻐 보이는 폰트가 버튼·본문에서 무너지는 일이 잦아서, 쓰일 자리에 직접 넣어본다.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* 게임 화면 */}
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <div className="bg-slate-900 p-5 text-white" style={{ fontFamily: ff }}>
                <div className="flex items-center justify-between text-xs opacity-70" style={{ fontWeight: regular }}>
                  <span>{MOCKUP_TEXT.label}</span>
                  <span className="tabular-nums">{MOCKUP_TEXT.hud}</span>
                </div>
                <h3 className="mt-6 text-3xl" style={{ fontWeight: bold }}>{MOCKUP_TEXT.title}</h3>
                <button
                  type="button"
                  className="mt-6 w-full rounded bg-emerald-500 px-4 py-2.5 text-slate-900"
                  style={{ fontWeight: bold }}
                >
                  {MOCKUP_TEXT.button}
                </button>
              </div>
              <div className="px-3 py-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>게임 HUD</div>
            </div>

            {/* 앱 화면 */}
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <div className="p-5" style={{ fontFamily: ff, background: 'var(--surface)' }}>
                <h3 className="text-lg" style={{ fontWeight: bold }}>{MOCKUP_TEXT.title}</h3>
                <p className="mt-2 break-keep text-sm leading-relaxed" style={{ fontWeight: regular }}>
                  {MOCKUP_TEXT.body}
                </p>
                <div className="mt-4 flex gap-2">
                  <button type="button" className="rounded px-3 py-1.5 text-sm text-white"
                          style={{ background: 'var(--accent)', fontWeight: regular }}>
                    {MOCKUP_TEXT.button}
                  </button>
                  <button type="button" className="rounded border px-3 py-1.5 text-sm"
                          style={{ borderColor: 'var(--border)', fontWeight: regular }}>
                    취소
                  </button>
                </div>
              </div>
              <div className="border-t px-3 py-1.5 text-[11px]"
                   style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}>
                앱 다이얼로그
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            작은 크기에서
          </h2>
          <div className="space-y-1 rounded border p-4" style={{ borderColor: 'var(--border)', fontFamily: ff }}>
            {[11, 13, 15, 17].map((s) => (
              <p key={s} className="break-keep" style={{ fontSize: s, fontWeight: regular }}>
                {s}px — {MOCKUP_TEXT.body}
              </p>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
