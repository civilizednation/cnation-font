import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'cnation font — 용도별 구글 한글 폰트 고르기',
  description:
    '구글 한글 폰트를 본문·UI·타이틀·게임 용도로 분류해서 실제 문구로 미리 보고, 필요한 글자만 담은 woff2 로 내보낸다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 폰트 CDN 연결을 미리 열어 첫 카드 렌더를 앞당긴다. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
