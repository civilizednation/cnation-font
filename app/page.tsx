import Gallery from '@/components/Gallery';
import index from '@/data/fonts.json';
import type { FontIndex } from '@/lib/types';

export default function Page() {
  return <Gallery index={index as FontIndex} />;
}
