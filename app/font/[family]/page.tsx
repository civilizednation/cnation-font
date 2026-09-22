import { notFound } from 'next/navigation';
import FontDetail from '@/components/FontDetail';
import index from '@/data/fonts.json';
import type { FontEntry, FontIndex } from '@/lib/types';

const data = index as FontIndex;

export function generateStaticParams() {
  return data.fonts.map((f) => ({ family: f.family }));
}

export default async function Page({ params }: { params: Promise<{ family: string }> }) {
  const { family } = await params;
  const font = data.fonts.find((f: FontEntry) => f.family === decodeURIComponent(family));
  if (!font) notFound();
  return <FontDetail font={font} />;
}
