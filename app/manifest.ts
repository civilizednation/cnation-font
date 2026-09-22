import type { MetadataRoute } from 'next';

// 폰의 홈 화면에 추가해두고 쓰라고 만든 매니페스트.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'cnation font',
    short_name: 'cnation font',
    description: '구글 한글 폰트를 용도별로 골라 쓸 글자만 담아 내보내기',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbfbfa',
    theme_color: '#2f6f4e',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
