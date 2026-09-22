import type { Metadata, Viewport } from 'next';
import './globals.css';

const DESCRIPTION =
  '구글 한글 폰트를 본문·UI·타이틀·게임 용도로 분류해서 실제 문구로 미리 보고, 필요한 글자만 담은 woff2 로 내보낸다.';

export const metadata: Metadata = {
  // OG 이미지를 절대 URL 로 바꾸는 데 필요하다. Vercel 배포 주소를 기준으로 잡는다.
  metadataBase: new URL('https://cnation-font.vercel.app'),
  title: {
    default: 'cnation font',
    template: '%s · cnation font', // 폰트 상세 페이지가 이 틀을 쓴다
  },
  description: DESCRIPTION,
  applicationName: 'cnation font',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: 'cnation font',
    title: 'cnation font',
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: 'cnation font', description: DESCRIPTION },
  // app/icon.png, app/apple-icon.png, app/opengraph-image.png 는 Next 가 자동으로 연결한다.
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfa' },
    { media: '(prefers-color-scheme: dark)', color: '#16161a' },
  ],
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
