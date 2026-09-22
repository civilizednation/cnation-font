import Link from 'next/link';
import Exporter from '@/components/Exporter';
import index from '@/data/fonts.json';
import type { FontEntry, FontIndex } from '@/lib/types';

const data = index as FontIndex;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ families?: string }>;
}) {
  const { families } = await searchParams;
  const wanted = (families ?? '').split(',').map(decodeURIComponent).filter(Boolean);
  const fonts = wanted
    .map((f) => data.fonts.find((x: FontEntry) => x.family === f))
    .filter((f): f is FontEntry => Boolean(f));

  if (fonts.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          내보낼 폰트가 없어. 갤러리에서 비교함에 담고 다시 와.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          갤러리로
        </Link>
      </div>
    );
  }
  return <Exporter fonts={fonts} />;
}
