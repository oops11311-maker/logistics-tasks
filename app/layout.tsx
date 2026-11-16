import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "물류자동화팀 작업",
  description: "물류자동화팀의 작업, 기한, 담당을 한곳에서 추적합니다.",
  manifest: "/manifest.webmanifest",
  applicationName: "물류작업",
  appleWebApp: { capable: true, title: "물류작업", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1b2830",
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
