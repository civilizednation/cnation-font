'use client';

import Link from 'next/link';
import { useState } from 'react';
import { buildCssUrl, extractFontUrls, normalizeText } from '@/lib/googleFonts';
import type { FontEntry } from '@/lib/types';

interface Built {
  family: string;
  files: { weights: number[]; bytes: number; blobUrl: string; fileName: string }[];
  css: string;
  totalBytes: number;
  fullBytes: number | null;
}

/**
 * 굵기를 파일(URL) 단위로 묶는다. 가변폰트는 요청한 굵기가 전부 같은 woff2 를
 * 가리키므로, 묶지 않으면 같은 파일을 굵기 수만큼 내려받아 저장하고 절감률도
 * 그만큼 부풀려 계산한다. 정적 폰트는 굵기마다 URL 이 달라 그대로 나뉜다.
 */
function groupByFile(entries: { weight: number; url: string }[]) {
  const byUrl = new Map<string, number[]>();
  for (const { weight, url } of entries) {
    byUrl.set(url, [...(byUrl.get(url) ?? []), weight]);
  }
  return [...byUrl].map(([url, weights]) => ({
    url,
    weights: [...new Set(weights)].sort((a, b) => a - b),
  }));
}

/** 가변폰트는 font-weight 에 범위를 적어야 중간 굵기까지 쓸 수 있다. */
const weightDecl = (weights: number[]) =>
  weights.length === 1 ? `${weights[0]}` : `${weights[0]} ${weights[weights.length - 1]}`;

const fmt = (b: number) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function Exporter({ fonts }: { fonts: FontEntry[] }) {
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(fonts.map((f) => [f.family, [f.weights.includes(400) ? 400 : f.weights[0]]])),
  );
  const [busy, setBusy] = useState(false);
  const [built, setBuilt] = useState<Built[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleWeight = (family: string, w: number) =>
    setSelected((prev) => {
      const cur = prev[family] ?? [];
      const next = cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w].sort((a, b) => a - b);
      return { ...prev, [family]: next.length ? next : cur };
    });

  async function build() {
    const chars = normalizeText(text);
    if (!chars) {
      setError('앱에 실제로 쓸 문구를 넣어줘. 그 글자만 담은 폰트를 만들어.');
      return;
    }
    setBusy(true);
    setError(null);
    setBuilt(null);

    try {
      const results: Built[] = [];
      for (const font of fonts) {
        const weights = selected[font.family] ?? [400];

        // 서브셋 CSS 와, 비교용 전체 CSS 를 함께 받는다.
        const [subsetCss, fullCss] = await Promise.all([
          fetch(buildCssUrl([{ family: font.family, weights }], chars)).then((r) => r.text()),
          fetch(buildCssUrl([{ family: font.family, weights }], '')).then((r) => r.text()),
        ]);

        const files: Built['files'] = [];
        for (const { url, weights: fileWeights } of groupByFile(extractFontUrls(subsetCss))) {
          const buf = await fetch(url).then((r) => r.arrayBuffer());
          const label =
            fileWeights.length === 1
              ? `${fileWeights[0]}`
              : `${fileWeights[0]}-${fileWeights[fileWeights.length - 1]}var`;
          files.push({
            weights: fileWeights,
            bytes: buf.byteLength,
            blobUrl: URL.createObjectURL(new Blob([buf], { type: 'font/woff2' })),
            fileName: `${slug(font.family)}-${label}-subset.woff2`,
          });
        }

        // 원본 크기는 HEAD 로 합산한다. 전체 한글 폰트는 unicode-range 조각이
        // 100개가 넘어서 실제로 받으면 수 MB 다.
        // 원본 크기는 HEAD 로 합산한다. 전체 한글 폰트는 unicode-range 조각이
        // 100개가 넘어서 실제로 받으면 수 MB 다. 여기서도 URL 중복을 먼저 지운다.
        let fullBytes: number | null = 0;
        const fullUrls = [...new Set(extractFontUrls(fullCss).map((f) => f.url))];
        try {
          const sizes = await Promise.all(
            fullUrls.map((u) =>
              fetch(u, { method: 'HEAD' }).then(
                (r) => Number(r.headers.get('content-length')) || 0,
              ),
            ),
          );
          fullBytes = sizes.reduce((a, b) => a + b, 0) || null;
        } catch {
          fullBytes = null;
        }

        const css = files
          .map(
            (f) => `@font-face {
  font-family: '${font.family}';
  font-style: normal;
  font-weight: ${weightDecl(f.weights)};
  font-display: swap;
  src: url('./fonts/${f.fileName}') format('woff2');
}`,
          )
          .join('\n\n');

        results.push({
          family: font.family,
          files,
          css,
          totalBytes: files.reduce((a, f) => a + f.bytes, 0),
          fullBytes,
        });
      }
      setBuilt(results);
    } catch (err) {
      setError(`폰트를 가져오지 못했어: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const pyftsubset = built
    ?.map((b) =>
      (selected[b.family] ?? []).map((w) =>
        `pyftsubset ${slug(b.family)}-${w}.ttf \\
  --text="${text.replace(/"/g, '\\"')}" \\
  --flavor=woff2 --layout-features='*' \\
  --output-file=${slug(b.family)}-${w}-subset.woff2`,
      ).join('\n\n'),
    )
    .join('\n\n');

  return (
    <div className="min-h-screen">
      <header className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-3xl px-4 py-3">
          <Link href="/" className="text-sm hover:underline" style={{ color: 'var(--muted)' }}>
            ← 갤러리
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <section>
          <h1 className="text-xl font-bold">최적화해서 내보내기</h1>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            아래에 넣은 글자만 담긴 woff2 를 만든다. 전체 한글 폰트는 1.8MB 쯤 되지만,
            앱에서 실제로 쓰는 문구만 남기면 보통 수 KB 로 떨어진다.
          </p>
        </section>

        <section className="space-y-3">
          {fonts.map((f) => (
            <div key={f.family} className="rounded border p-3" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-2 text-sm font-semibold">{f.family}</div>
              <div className="flex flex-wrap gap-1.5">
                {f.weights.map((w) => {
                  const on = (selected[f.family] ?? []).includes(w);
                  return (
                    <button
                      key={w} type="button" onClick={() => toggleWeight(f.family, w)}
                      aria-pressed={on}
                      className="rounded border px-2 py-1 text-xs tabular-nums"
                      style={{
                        borderColor: on ? 'var(--accent)' : 'var(--border)',
                        background: on ? 'var(--accent-soft)' : 'transparent',
                        color: on ? 'var(--accent)' : 'var(--muted)',
                      }}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
                 style={{ color: 'var(--muted)' }}>
            앱에 쓸 텍스트 전부
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={'시작하기\n레벨 선택\n계속하기\nSCORE 1250\n설정\n다시 하기'}
            className="w-full rounded border px-3 py-2 font-mono text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            고유 글자 {normalizeText(text).length}자
            {' · '}나중에 문구가 늘면 다시 내보내야 하니, 쓸 만한 문구를 넉넉히 넣어두는 게 좋아.
          </p>
        </section>

        <button
          type="button" onClick={build} disabled={busy}
          className="w-full rounded px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {busy ? '만드는 중…' : '서브셋 만들기'}
        </button>

        {error && (
          <p className="rounded border px-3 py-2 text-sm"
             style={{ borderColor: '#c0504d', color: '#c0504d' }}>
            {error}
          </p>
        )}

        {built && (
          <section className="space-y-5">
            {built.map((b) => (
              <div key={b.family} className="rounded border p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold">{b.family}</h2>
                  <span className="text-xs tabular-nums" style={{ color: 'var(--accent)' }}>
                    {b.fullBytes
                      ? `${fmt(b.fullBytes)} → ${fmt(b.totalBytes)} (${(100 - (b.totalBytes / b.fullBytes) * 100).toFixed(1)}% 감소)`
                      : fmt(b.totalBytes)}
                  </span>
                </div>

                <div className="mb-3 space-y-1">
                  {b.files.map((f) => (
                    <a
                      key={f.fileName} href={f.blobUrl} download={f.fileName}
                      className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:underline"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                    >
                      <span className="font-mono">{f.fileName}</span>
                      <span className="tabular-nums">
                        {f.weights.length > 1 && `굵기 ${weightDecl(f.weights)} · `}
                        {fmt(f.bytes)} ↓
                      </span>
                    </a>
                  ))}
                </div>

                <pre className="overflow-x-auto rounded p-3 text-xs leading-relaxed"
                     style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <code>{b.css}</code>
                </pre>
              </div>
            ))}

            <details className="rounded border p-4" style={{ borderColor: 'var(--border)' }}>
              <summary className="cursor-pointer text-sm font-semibold">
                로컬에서 직접 서브셋하려면 (pyftsubset)
              </summary>
              <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                구글 서브셋에는 없는 OpenType 기능까지 남기고 싶을 때 쓴다.
                원본 ttf 는 github.com/google/fonts 에서 받는다.
              </p>
              <pre className="mt-2 overflow-x-auto rounded p-3 text-xs"
                   style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <code>{pyftsubset}</code>
              </pre>
            </details>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              구글 폰트는 대부분 OFL 이라 서브셋한 파일을 앱에 포함해 배포할 수 있어.
              라이선스 파일을 프로젝트에 같이 넣어두는 걸 권해.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
