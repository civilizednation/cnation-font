import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import FontDetail from '@/components/FontDetail';
import index from '@/data/fonts.json';
import type { FontEntry, FontIndex } from '@/lib/types';

const data = index as FontIndex;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ family: string }>;
}): Promise<Metadata> {
  const { family } = await params;
  const font = data.fonts.find((f: FontEntry) => f.family === decodeURIComponent(family));
  if (!font) return {};
  return {
    title: font.family, // 루트 레이아웃의 "%s · cnation font" 틀에 들어간다
    description: `${font.family} — 굵기 ${font.weights.length}종. 실제 문구로 미리 보고 쓸 글자만 담아 내보낸다.`,
  };
}

export function generateStaticParams() {
  return data.fonts.map((f) => ({ family: f.family }));
}

export default async function Page({ params }: { params: Promise<{ family: string }> }) {
  const { family } = await params;
  const font = data.fonts.find((f: FontEntry) => f.family === decodeURIComponent(family));
  if (!font) notFound();
  return <FontDetail font={font} />;
}
