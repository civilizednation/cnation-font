'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BATCH_SIZE, buildCssUrl, loadCss, normalizeText, type FontRequest } from './googleFonts';

/**
 * 화면에 보이는 카드의 폰트만 불러온다.
 *
 * 카드가 뷰포트에 가까워지면 요청 큐에 넣고, 60ms 모았다가 BATCH_SIZE 개씩 묶어
 * CSS 한 장으로 받는다. 100개를 한꺼번에 받지 않는 게 요점이다.
 *
 * 미리보기 텍스트가 바뀌면 text= 가 바뀌어 기존 폰트 파일이 무의미해지므로
 * 로드 상태를 비우고 다시 받는다. 이 리셋은 effect 가 아니라 렌더 중에 해야 한다 —
 * React 는 자식 effect 를 부모보다 먼저 실행하므로, effect 에서 비우면 카드들이
 * 이미 옛 텍스트로 요청을 넣은 뒤에 큐가 지워진다.
 */
export function useFontLoader(text: string) {
  const normalized = normalizeText(text);

  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [trackedText, setTrackedText] = useState(normalized);

  const pending = useRef(new Map<string, FontRequest>());
  const requested = useRef(new Set<string>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef(normalized);

  if (trackedText !== normalized) {
    setTrackedText(normalized);
    textRef.current = normalized;
    requested.current.clear();
    pending.current.clear();
    setLoaded(new Set());
  }

  const flush = useCallback(() => {
    flushTimer.current = null;
    const queue = [...pending.current.values()];
    pending.current.clear();
    if (queue.length === 0) return;

    const text = textRef.current;
    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      const batch = queue.slice(i, i + BATCH_SIZE);
      loadCss(buildCssUrl(batch, text)).then(() => {
        // 그 사이 텍스트가 바뀌었으면 이 결과는 버린다.
        if (textRef.current !== text) return;
        setLoaded((prev) => {
          const next = new Set(prev);
          for (const r of batch) next.add(r.family);
          return next;
        });
      });
    }
  }, []);

  /** 카드가 보이는 동안 호출한다. 같은 조합은 알아서 한 번만 나간다. */
  const request = useCallback(
    (family: string, weights: number[]) => {
      const key = `${family}:${weights.join(',')}`;
      if (requested.current.has(key)) return;
      requested.current.add(key);
      pending.current.set(key, { family, weights });

      // 스크롤 한 번에 들어온 카드들을 한 묶음으로 만든다.
      if (flushTimer.current === null) flushTimer.current = setTimeout(flush, 60);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
    },
    [],
  );

  return { loaded, request, normalizedText: normalized };
}

/**
 * 요소가 뷰포트 근처에 한 번이라도 들어왔는지. 한 번 true 가 되면 유지한다 —
 * 스크롤로 지나간 카드의 폰트를 다시 내릴 이유가 없고, 깜빡임만 생긴다.
 *
 * resetKey 가 바뀌면 (= 미리보기 텍스트가 바뀌어 폰트를 다시 받아야 하면)
 * visible 을 되돌려 관찰을 다시 건다. 이게 없으면 38종을 끝까지 스크롤한 뒤
 * 텍스트를 한 글자 고칠 때마다 38개가 전부 재요청되어 1MB 넘게 나간다.
 * 되돌리면 지금 화면에 걸친 카드만 즉시 다시 true 가 된다.
 */
export function useInView<T extends HTMLElement>(resetKey?: unknown) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  const [trackedKey, setTrackedKey] = useState(resetKey);

  if (trackedKey !== resetKey) {
    setTrackedKey(resetKey);
    setVisible(false);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      // 한글 폰트는 한 벌에 30KB 가까이 되므로 프리페치 여유를 좁게 잡는다.
      { rootMargin: '200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return { ref, visible };
}
